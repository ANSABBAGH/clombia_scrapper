import _ from "lodash";
import { DemoParser } from "./src/parsers/DemoParser.class";
import { VerticalParser } from "./src/parsers/VerticalParser.class";
import { GooglePlaceScrapper } from "./src/scrappers/GooglePlaceScrapper.class";
import { StorageManager } from "./src/service/StorageManager.service";
import { FileSystem } from "./src/service/FileSystem.service";
import Papa from "papaparse";
import fs from "fs";
import dotenv from "dotenv";
import { DEBOUNCE_CHUNK_NUMBER, EXPORT_CSV_PATH, EXPORT_JSON_PATH } from "./config";
import { ICityVertical, ICityVerticals, IStorageRequest } from "types";

dotenv.config();
const verticalParser = new VerticalParser();
const demoParser = new DemoParser(verticalParser);
const googlePlaceScrapper = new GooglePlaceScrapper();
const storageManager = new StorageManager();
const fileSystem = new FileSystem();
fileSystem.init();

async function main() {
  await verticalParser.upsertVerticals();
  const demoCompanies = await demoParser.parseDemoCsv();

  // split demoCompanies into X arrays
  let demoCompaniesChunks: ICityVerticals[][] = _.chunk(
    demoCompanies,
    Math.ceil(demoCompanies.length / DEBOUNCE_CHUNK_NUMBER)
  );

  const allResults = [];
  let chunkCount = 0;

  for (const demoCompaniesChunk of demoCompaniesChunks) {
    console.log("new chunk", chunkCount++ + " / " + demoCompaniesChunks.length);
    const chunkResult = await Promise.all(
      demoCompaniesChunk.map(async (demoCompany) => {
        const { city, verticals, citySectorCode } = demoCompany;
        if (!city) return Promise.resolve(null);

        let location = await storageManager.getCollectionLocationByCity(city);
        if (!location) {
          location = await googlePlaceScrapper.getLocationFromCityName(city, citySectorCode);
          await storageManager.addCollectionLocation(city, location);
        }
        if (!location) return Promise.resolve(null);
        const data = await Promise.all(
          verticals.map(async (vertical) => {
            const url = googlePlaceScrapper.buildPlacesUrl(vertical.verticalName, location);

            const cachedData = (await storageManager.getCollectionRequestByUrl(
              url
            )) as unknown as IStorageRequest[];

            if (cachedData) {
              return parseCachedData(cachedData, url, vertical, city);
            }

            const { results, ...rest } = await googlePlaceScrapper.getPlaces(url);

            const slicedResults = results.length ? results.slice(0, vertical.qte) : [];
            googlePlaceScrapper.populateMonitoring(slicedResults, vertical.qte, city);

            const resultEnriched = await Promise.all(
              slicedResults.map(async (result) => {
                const placeId = result.place_id;
                const enrichedData = (await googlePlaceScrapper.getFromPlaceId(placeId)).result;
                return {
                  ...result,
                  ...enrichedData,
                  vertical: vertical.verticalName,
                  verticalCode: vertical.verticalCode,
                  sectorCode: citySectorCode,
                  sector: city
                };
              })
            );
            const dataFormatted = await googlePlaceScrapper.mapDataFromGooglePlaceApi(
              resultEnriched
            );
            await storageManager.addCollectionRequest(url, dataFormatted);
            return dataFormatted;
          })
        );

        const results = _.flatten(data);

        return results;
      })
    );
    allResults.push(...chunkResult.filter((el) => el));
  }

  console.log("finished");
  fs.writeFileSync(EXPORT_JSON_PATH, JSON.stringify(_.flatten(allResults), null, 2), {
    encoding: "utf8"
  });

  jsonToCsv();
  await googlePlaceScrapper.writeMonitoring();
  console.log("number of call to google api:", googlePlaceScrapper.monitoring.numberOfCall);
}

main();

async function jsonToCsv() {
  const data = JSON.parse(fs.readFileSync(EXPORT_JSON_PATH).toString());
  const csv = Papa.unparse(data, {
    delimiter: ";"
  });
  fs.writeFileSync(EXPORT_CSV_PATH, csv, {
    encoding: "utf8"
  });
}

async function parseCachedData(
  cachedData: IStorageRequest[],
  url: string,
  vertical: ICityVertical,
  city: string
) {
  console.log("cached data", url);
  const formattedData = cachedData.map((el) => JSON.parse(el.data));
  googlePlaceScrapper.populateMonitoring(formattedData, vertical.qte, city);
  if (!formattedData.length) return;
  return formattedData.flat();
}

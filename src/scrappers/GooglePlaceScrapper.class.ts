import process from "process";
import { Storage } from "@google-cloud/storage";
import axios from "axios";
import path from "path";
import { EXPORT_MONITORING, GOOGLE_SCRAP_FILTER_TYPE } from "../../config";
import fs from "fs";
import { type } from "os";
import { StorageManager } from "../service/StorageManager.service"

const DEFAULT_RADIUS = 5000;

interface GetPlacesResponse {
  results: any[];
  next_page_token: string;
}

interface IMonitoring {
  total: number;
  success: number;
  error: number;
  numberOfCall: number;
  resultPerCity: {
    [key: string]: {
      total: number;
      success: number;
      error: number;
    };
  };
}

export class GooglePlaceScrapper {
  private static baseUrl = "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
  private static placesBaseUrl = "https://maps.googleapis.com/maps/api/place/details/json";
  private static locationBaseUrl = `https://maps.googleapis.com/maps/api/geocode/json`;
  private static photoBaseUrl = `https://maps.googleapis.com/maps/api/place/photo`;
  private static googleBucketBaseUrl = `https://storage.googleapis.com`;
  private storage = new Storage({ keyFilename: "./credentials.json" });
  private bucket = this.storage.bucket(process.env.GCLOUD_STORAGE_BUCKET);
  public monitoring: IMonitoring = {
    total: 0,
    success: 0,
    error: 0,
    resultPerCity: {},
    numberOfCall: 0
  };

  public csvHeaderGooglePlaceMapping = {
    "nom de l´entreprise": ({ name }) => name,
    "code vertical": ({ verticalCode }) => verticalCode,
    "vertical": ({ verticalName }) => verticalName,
    "code secteur": ({ citySectorCode }) => citySectorCode,
    "secteur": ({ city }) => city,
    "# batiment": ({ address_components }) => {
      return address_components.find((component) => component.types.includes("street_number"))
        ?.long_name;
    },
    "rue": ({ address_components }) => {
      return address_components.find((component) => component.types.includes("route"))?.long_name;
    },
    "cartier": ({ address_components }) => {
      return address_components.find((component) => component.types.includes("sublocality"))
        ?.long_name;
    },
    "csvVille": ({ sector }) => sector,
    "ville": ({ address_components }) => {
      return address_components.find((component) => component.types.includes("locality"))
        ?.long_name;
    },
    "province": ({ address_components }) => {
      return address_components.find((component) =>
        component.types.includes("administrative_area_level_1")
      )?.long_name;
    },
    "code postal": ({ address_components }) => {
      return address_components.find((component) => component.types.includes("postal_code"))
        ?.long_name;
    },

    "courriel": () => null,
    "# telephone": ({ formatted_phone_number, international_phone_number }) => {
      return international_phone_number || formatted_phone_number;
    },
    "site web": ({ website }) => website,
    "facebook URL": ({ facebook }) => facebook,
    "instagram	URL": ({ instagram }) => instagram,
    "logo": ({ icon }) => icon,
    "comptant": () => null,
    "visa": () => null,
    "mastercard": () => null,
    "american express": () => null,
    "virement": () => null,
    "chèque": () => null,

    spreadFunctions: [
      async ({ photos, place_id }) => {
        if (!photos) photos = [];
        const photosScrapped = await Promise.all(
          photos.map(async (photo, index) => {
            const googlePhoto = await this.getPhotoUrl(photo.photo_reference);
            return this.uploadToBucketFromUrl(
              googlePhoto,
              path.join(place_id, "" + index + ".jpg")
            );
          })
        );
        const fillFieldArray = new Array(
          photosScrapped.length <= 9 ? 9 - photosScrapped.length : 0
        ).fill("");
        return photosScrapped.concat(fillFieldArray).reduce((acc, photo, index) => {
          acc["Url photo " + index] = photo;
          return acc;
        }, {});
      },
      ({ opening_hours }) => {
        if (!opening_hours || !opening_hours?.weekday_text) return {};
        const weekdayTextMapper = {
          Monday: "Lundi",
          Tuesday: "Mardi",
          Wednesday: "Mercredi",
          Thursday: "Jeudi",
          Friday: "Vendredi",
          Saturday: "Samedi",
          Sunday: "Dimanche"
        };
        return opening_hours?.weekday_text.reduce((acc, day) => {
          const [dayName, hours] = day.split(": ");
          acc["H" + weekdayTextMapper[dayName]] = hours;
          return acc;
        }, {});
      },
      async ({ website }) => {
        if (!website) return {};
        try {
          const websiteAsString = (await axios.get(website)).data;
          if (typeof websiteAsString !== "string") {
            return {};
          }
          // find email or facebook or instagram url
          const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g;
          const facebookRegex = /facebook\.com\/[a-zA-Z0-9._-]+/g;
          const instagramRegex = /instagram\.com\/[a-zA-Z0-9._-]+/g;
          const email = websiteAsString.match(emailRegex);
          const facebook = websiteAsString.match(facebookRegex);
          const instagram = websiteAsString.match(instagramRegex);
          return {
            "courriel": email,
            "facebook URL": facebook,
            "instagram URL": instagram
          };
        } catch (e) {
          console.error("Error occurred during website scraping:", e.config.url);
          return {};
        }
      },
      async ({ types }) => {
        if (!types) types = [];
        const fillFieldArray = new Array(types.length <= 9 ? 9 - types.length : 0).fill("");
        return types.concat(fillFieldArray).reduce((acc, type, index) => {
          const copyAcc = { ...acc };
          if (GOOGLE_SCRAP_FILTER_TYPE.includes(type)) {
            copyAcc["Service " + index] = "";
            return copyAcc;
          }
          copyAcc["Service " + index] = type;
          return copyAcc;
        }, {});
      }
    ]
  };
  // memoization should be done in a database
  private memoizedCityLocation;
  private apiKey = process.env.GOOGLE_MAP_API_KEY;
  private static instance: GooglePlaceScrapper;

  constructor() {
    this.memoizedCityLocation = {};
  }

  static getInstance() {
    if (!GooglePlaceScrapper.instance) {
      GooglePlaceScrapper.instance = new GooglePlaceScrapper();
    }
    return GooglePlaceScrapper.instance;
  }

  async uploadToBucketFromUrl(url: string, fileName: string) {
    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer"
      });
      const buffer = Buffer.from(response.data, "binary");
      const file = this.bucket.file(fileName);
      const publicUrl = `${GooglePlaceScrapper.googleBucketBaseUrl}/${process.env.GCLOUD_STORAGE_BUCKET}/${fileName}`;
      if ((await file.exists())[0]) return publicUrl;
      await new Promise((resolve, reject) => {
        file.createWriteStream().on("error", reject).on("finish", resolve).end(buffer);
      });

      return publicUrl;
    } catch (e) {
      console.error("Error occurred during getting the image:", e.config.url);
    }
  }

  public async getLocationFromCityName(city: string, sectorCode: string) {
    if (this.memoizedCityLocation[sectorCode]) {
      return this.memoizedCityLocation[sectorCode];
    }
    this.monitoring.numberOfCall++
    const data = (
      await axios.get(`${GooglePlaceScrapper.locationBaseUrl}?address=${city}&key=${this.apiKey}`)
    ).data;
    if (!data.results[0]) return false;
    const { lat, lng } = data.results[0].geometry.location;
    const formattedLocation = `${lat}%2C${lng}`;
    this.memoizedCityLocation[sectorCode] = formattedLocation;
    return formattedLocation;
  }

  public buildPlacesUrl(type: string, location: string, currentPageToken?: string) {
    const url = `${
      GooglePlaceScrapper.baseUrl
    }?location=${location}&radius=${DEFAULT_RADIUS}&keyword=${type}${
      currentPageToken ? `&pagetoken=${currentPageToken}` : ""
    }&key=${this.apiKey}`;
    return url;
  }

  public async getPlaces(
    url: string
  ): Promise<GetPlacesResponse> {
    const response = (await this.get(url)).data;
    this.monitoring.numberOfCall++
    const { results, next_page_token } = response;
    return { results, next_page_token };
  }

  public populateMonitoring(results: any[], qte: number, city: string) {
    const hasSuccess = results.length >= qte;
    this.monitoring[hasSuccess ? "success" : "error"] += qte;
    this.monitoring.total = this.monitoring.success + this.monitoring.error;
    if (!this.monitoring.resultPerCity[city])
      this.monitoring.resultPerCity[city] = {
        success: 0,
        error: 0,
        total: 0
      };
    this.monitoring.resultPerCity = {
      ...this.monitoring.resultPerCity,
      [city]: {
        success: this.monitoring.resultPerCity?.[city]?.success + (hasSuccess ? qte : 0),
        error:
          this.monitoring.resultPerCity?.[city]?.error + (!hasSuccess ? qte - results.length : 0),
        total:
          this.monitoring.resultPerCity?.[city]?.success +
          this.monitoring.resultPerCity?.[city]?.error +
          qte
      }
    };
  }

  public async writeMonitoring() {
    const storageManager = new StorageManager()
    for (const [city, cityData] of Object.entries(this.monitoring.resultPerCity)) {
      if (await storageManager.getCollectionMonitoringByCity(city)) {
        console.log('update cache', city)
        storageManager.updateCollectionMonitoringByCity(city, cityData)
        continue
      }
      storageManager.addCollectionMonitoring(city, cityData)
    }
    const monitoring = {
      ...this.monitoring,
      date: new Date().toISOString()
    };
    fs.writeFileSync(path.join(EXPORT_MONITORING), JSON.stringify(monitoring, null, 2));
  }

  public async getFromPlaceId(placeId: string) {
    this.monitoring.numberOfCall++
    return (
      await axios.get(`${GooglePlaceScrapper.placesBaseUrl}?place_id=${placeId}&key=${this.apiKey}`)
    ).data;
  }

  public async mapDataFromGooglePlaceApi(results) {
    return Promise.all(
      results.map(async (result) => {
        const data = {};
        Object.keys(this.csvHeaderGooglePlaceMapping).forEach((key) => {
          if (key === "spreadFunctions") return;
          data[key] = this.csvHeaderGooglePlaceMapping[key](result);
        });
        for (const spreadFunction of this.csvHeaderGooglePlaceMapping.spreadFunctions) {
          const spreadData = await spreadFunction(result);
          if (!spreadData) continue;
          Object.keys(spreadData).forEach((key) => {
            data[key] = spreadData[key];
          });
        }
        return data;
      })
    );
  }

  public getPhotoUrl(photoReference: string) {
    this.monitoring.numberOfCall++
    return `${GooglePlaceScrapper.photoBaseUrl}?maxwidth=400&photoreference=${photoReference}&key=${this.apiKey}`;
  }

  private get(url: string) {
    return axios.get(url);
  }
}

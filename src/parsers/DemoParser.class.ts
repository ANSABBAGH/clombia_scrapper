import fs from "fs";
import { DEMO_CSV_PATH, LINE_BREAK, DELIMITERS, LOCALE } from "../../config";
import { ICityVerticals } from "../../types";
import { VerticalParser } from "./VerticalParser.class";

const LOCALE_INDEX_TO_JOBS = {
  "ES": 6,
  "FR": 5,
  "QC": 4
};

const COLUMN_INDEX_TO_CITY = 2;
const ROW_INDEX_TO_CITY = 7;
const ROW_INDEX_TO_VERTICALS = 4;

export class DemoParser {
  companiesToScrap: ICityVerticals[];

  constructor(private verticalParser: VerticalParser) {}

  public parseDemoCsv(): ICityVerticals[] {
    const csvData = fs.readFileSync(DEMO_CSV_PATH);
    const companiesToScrap = [];

    const rows = csvData.toString().split(LINE_BREAK);
    const headerRow = rows[LOCALE_INDEX_TO_JOBS[LOCALE]].split(DELIMITERS);

    for (let i = ROW_INDEX_TO_CITY; i < rows.length; i++) {
      const column = rows[i].split(DELIMITERS);
      const city = column[COLUMN_INDEX_TO_CITY];
      const citySectorCode = column[COLUMN_INDEX_TO_CITY - 1];
      const verticals = [];

      for (let j = ROW_INDEX_TO_VERTICALS; j < column.length; j++) {
        const quantity = column[j];
        const verticalName = headerRow[j];
        // fixme: remove this line
        if (verticalName === "ES") continue;
        if (!quantity) continue;
        verticals.push({
          verticalName: verticalName,
          verticalCode: this.verticalParser.getCodeVerticalByVerticalName(headerRow[j]),
          qte: +quantity
        });
      }

      if (verticals.length > 0) {
        companiesToScrap.push({ city, citySectorCode, verticals });
      }
    }
    this.companiesToScrap = companiesToScrap;
    return companiesToScrap;
  }
}

import fs from "fs";
import _ from "lodash";
import csvToJson from "csvtojson";
import { VERTICAL_CSV_PATH, LOCALE } from "../../config";
import { IVertical } from "../../types";

export class VerticalParser {
  verticals: null | IVertical[];

  constructor() {
    this.verticals = null;
  }

  public async upsertVerticals() {
    if (!this.verticals) {
      this.verticals = await this.parseVerticalCsv();
    }
    return this.verticals;
  }

  public async parseVerticalCsv(): Promise<IVertical[]> {
    const data = fs.readFileSync(VERTICAL_CSV_PATH).toString();
    const jsonArray = await csvToJson({ delimiter: ";" }).fromString(data);
    return jsonArray;
  }

  public getCodeVerticalByVerticalName(name: string) {
    const vertical = this.verticals.find((vertical) => vertical[LOCALE].trim() === name.trim());
    if (!vertical) throw new Error(`Vertical ${name} not found`);
    return vertical["code vertical"];
  }

  public getVerticalNameByCodeVertical(code: string | number) {
    if (typeof code === "number") code = code.toString();
    const vertical = this.verticals.find((vertical) => vertical["code vertical"].trim() === code);
    if (!vertical) throw new Error(`Vertical code ${code} not found`);
    return vertical[LOCALE];
  }
}

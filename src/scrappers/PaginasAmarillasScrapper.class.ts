import axios from "axios";
import jsdom from "jsdom";
import { ICityVerticals, IDemoCompany } from "../../types";
import { VerticalParser } from "../parsers/VerticalParser.class";

const PAGE_AMARILLAS_BASE_URL = "https://www.paginasamarillas.com";
const REGIONS = ["Bogota", "Medellin", "Baranquilla", "Cucuta", "Pereira", "Santa Marta"];
const { JSDOM } = jsdom;

export class PaginasAmarrillasScrapper {
  private cityVerticals: ICityVerticals[];

  constructor(cityVerticals: ICityVerticals[]) {
    this.cityVerticals = cityVerticals
  }

  private async scrap() {
    for (const companyToScrap of this.cityVerticals) {
      const { city, verticals } = companyToScrap;
      const sanitizedCity = this.sanitizeCity(city);
      for (const verticalToScrap of verticals) {
        const { verticalName, verticalCode, qte } = verticalToScrap;
        const sanitizedVerticalName = this.sanitizeVerticalName(verticalName);
        const url = this.buildUrl(sanitizedCity, sanitizedVerticalName);
        const response = (await axios.get(url)).data;
        const domResponse = new JSDOM(response);
        const extractedData = this.extractData(domResponse, qte);
        console.log(response);
      }
    }
  }

  private async extractData(response: jsdom.JSDOM, qte: number): Promise<string> {
    const {
      window: { document }
    } = response;
    const ads = document.querySelectorAll(".advertise");
    const adsData =
      ads.length > qte
        ? [...ads].slice(0, qte)
        : [...ads];

    await Promise.all(
      adsData.map(async (ad) => {
        const name = ad.querySelector(".title").innerHTML;
        const address = ad.querySelector(".address > div > b").innerHTML;
        const phone = ad.querySelector(".phone").innerHTML;
        const website = (ad.querySelector(".address > a") as HTMLAnchorElement).href;
        const description = ad.querySelector(".text").textContent;
        const url = (ad.querySelector(".main > a") as HTMLAnchorElement).href;
        const specificAdPage = (await axios.get(url)).data;
        return {
          name,
          address,
          phone,
          website,
          url,
          description
        };
      })
    );
    return document.querySelector("#__NEXT_DATA__").innerHTML;
  }

  private buildUrl(city: string, vertical: string): string {
    return `${PAGE_AMARILLAS_BASE_URL}/${city}/${vertical}`;
  }

  private sanitizeCity(city: string): string {
    const regex = new RegExp(`(${REGIONS.join("|")})`, "g");
    return this.classicSanitize(city.replace(regex, ""));
  }

  private sanitizeVerticalName(verticalName: string): string {
    return this.classicSanitize(verticalName);
  }

  private classicSanitize(string: string) {
    return string
      .replace(/\(|\)/g, "")
      .replace(/[\s\/]+/g, "-")
      .toLowerCase();
  }
}

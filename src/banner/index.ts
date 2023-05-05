import { BANNERS_DIR } from "../../config";
import fs from "fs";
import _ from "lodash";
import path from "path";
import Mustache from "mustache";

interface IOptionsBanner {
  color?: string;
  name?: string;
  phoneNumber?: string;
  website?: string;
  image?: string;
}

const svgCondition = [
  {
    name: "test",
    filename: "test.svg",
    condition: ["color", "name", "phoneNumber", "website", "image"]
  }
];

export default function generateBanner(options: IOptionsBanner) {
  const svgConditionFiltered = svgCondition.filter(
    (svg) => _.difference(svg.condition, Object.keys(options)).length === 0
  );
  if (!svgConditionFiltered.length) return null;
  const randomSvg = _.sample(svgConditionFiltered);
  const svg = fs.readFileSync(path.join(BANNERS_DIR, randomSvg.filename), "utf-8").toString();

  return Mustache.render(svg, options);
}

const banner = generateBanner({
  color: "red",
  name: "test",
  phoneNumber: "123456789",
  website: "https://www.google.com",
  image: "https://www.google.com"
});

console.log(banner);

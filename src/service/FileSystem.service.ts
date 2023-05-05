import fs from "fs";
export class FileSystem {
  constructor() {}
  public init() {
    if (!fs.existsSync("export")) {
      console.log("creating export folder")
      fs.mkdirSync("export");
    }
  }
}

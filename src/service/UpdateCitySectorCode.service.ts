import { DEMO_CSV_PATH } from "../../config";
import fs from "fs";
import { StorageManager } from "./StorageManager.service";
import _ from "lodash";
let i = 0
async function UpdateCitySectorCode() {
  const csvData = fs.readFileSync(DEMO_CSV_PATH);
  const rows = csvData.toString().split("\n");
  const columnRows = rows.map((row) => row.split(";"));
  let cityBySectorCode = Object.fromEntries(
    columnRows.slice(7, 209).map((row) => row.slice(1, 3).reverse())
  );
  const storageManager = new StorageManager();
  // await storageManager.fillRequestFromRequestArchive();
  const requests = await storageManager.getCollectionRequestArchive()

  for (let request of requests) {
    const dataArray = JSON.parse(JSON.parse(request.data))
    if (!dataArray.length) continue
    const dataRequest = dataArray[0];

    if (!cityBySectorCode[dataRequest['code secteur']]) {
      i++
      console.log(i + " city not found", dataRequest['code secteur'])
      continue;
    }
    
    dataRequest.cityCsv = dataRequest['code secteur']
    dataRequest['code secteur'] = cityBySectorCode[dataRequest['code secteur']];

    for (let key in dataRequest) {
      if (!key.startsWith('Service')) continue
      if (dataRequest[key].length === 0) continue
      dataRequest[key] = _.startCase(_.toLower(dataRequest[key]))
    }

    await storageManager.addCollectionRequest(request.url, dataRequest)
  }
}
UpdateCitySectorCode();

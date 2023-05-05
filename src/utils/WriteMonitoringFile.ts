import { EXPORT_MONITORING, EXPORT_MONITORING_CSV } from "../../config"
import fs from 'fs'
import { StorageManager } from "../service/StorageManager.service"
import Papa from "papaparse"

(async function writeMonitoringFile() {
  if(!fs.existsSync('export')) fs.mkdirSync('export')
  if(!fs.existsSync(EXPORT_MONITORING)) fs.writeFileSync(EXPORT_MONITORING, JSON.stringify([]))
  const storageManager = new StorageManager()
  const monitoring = await storageManager.getCollectionMonitoring()
  fs.writeFileSync(EXPORT_MONITORING, JSON.stringify(monitoring, null, 2))
  // modify monitoring file to be in csv format
  const data = JSON.parse(fs.readFileSync(EXPORT_MONITORING).toString())
  const csv = Papa.unparse(data, {
    header: true,
    quotes: true,
    delimiter: ";"
  })
  fs.writeFileSync(EXPORT_MONITORING_CSV, csv, { encoding: "utf8"})
})()
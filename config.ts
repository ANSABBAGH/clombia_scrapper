import path from 'path'
import process from 'process'

export const DATA_DIR = path.join(process.cwd(), 'data')
export const BANNERS_DIR = path.join(process.cwd(), "src", "banner", "banners");
export const VERTICAL_CSV_PATH = path.join(DATA_DIR, 'verticaux.csv')
export const DEMO_CSV_PATH = path.join(DATA_DIR, 'demo2.csv')
export const DELIMITERS = ';'
export const LINE_BREAK = '\n'
export const LOCALE = 'ES'

export const EXPORT_DIRECTORY = path.join(process.cwd(), 'export')
export const EXPORT_JSON_PATH = path.join(EXPORT_DIRECTORY, 'data.json')
export const EXPORT_CSV_PATH = path.join(EXPORT_DIRECTORY, 'data.csv')
export const EXPORT_MONITORING = path.join(EXPORT_DIRECTORY, 'monitoring.json')
export const EXPORT_MONITORING_CSV = path.join(EXPORT_DIRECTORY, 'monitoring.csv')

export const DEBOUNCE_CHUNK_NUMBER = 10

export const GOOGLE_SCRAP_FILTER_TYPE = ["establishment", "point_of_interest", "food", "store"]

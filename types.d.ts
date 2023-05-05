export interface IVertical {
  "code vertical": string;
  "code réseau": string;
  Colonne1: string;
  QC: string;
  FR: string;
  ES: string;
}

export interface IDemoCompany {
  city: string;
  verticals: {
    value: string;
    qte: number;
  }[];
}

export interface ICityVerticals {
  city: string;
  citySectorCode: string;
  verticals: ICityVertical[];
}

export interface ICityVertical {
  verticalName: string;
  verticalCode: string;
  qte: number;
}

export interface IStorageRequest {
  url: string;
  data: string
}
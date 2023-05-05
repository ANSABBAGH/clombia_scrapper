import { Firestore } from "@google-cloud/firestore";

export class StorageManager {
  private firestore: Firestore;

  constructor() {
    this.firestore = new Firestore({
      projectId: process.env.GCLOUD_PROJECT_ID,
      keyFilename: "./credentials.json"
    });
  }

  public async getCollectionRequestByUrl(url: string) {
    const collection = await this.firestore.collection("requests").where("url", "==", url).get();
    if (collection.docs.length === 0) return null;
    return collection.docs.map((doc) => doc.data());
  }

  public async addCollectionRequest(url: string, data: any) {
    if (await this.getCollectionRequestByUrl(url)) return null;
    const collection = await this.firestore.collection("requests").add({
      url,
      data: JSON.stringify(data)
    });
    return collection;
  }

  public async addCollectionMonitoring(city: string, { success, error, total }: any) {
    const collection = await this.firestore.collection("monitoring").add({
      city,
      success,
      error,
      total
    });
    return collection;
  }

  public async getCollectionMonitoring() {
    const collection = await this.firestore.collection("monitoring").get();
    return collection.docs.map((doc) => doc.data());
  }

  public async getCollectionMonitoringByCity(city: string) {
    const collection = await this.firestore.collection("monitoring").where("city", "==", city).get();
    if (collection.docs.length === 0) return null;
    return collection.docs.map((doc) => doc.data());
  }

  public async updateCollectionMonitoringByCity(city: string, { success, error, total }: any) {
    const collection = await this.firestore.collection("monitoring").where("city", "==", city).get();
    if (collection.docs.length === 0) return null;
    const doc = collection.docs[0];
    await doc.ref.update({
      success: success,
      error: error,
      total: total
    });
    return collection.docs.map((doc) => doc.data());
  }

  public async getCollectionRequest() {
    const collection = await this.firestore.collection("requests").get();
    return collection.docs.map((doc) => doc.data());
  }

  public async fillCollectionRequestArchive() {
    const data = await this.getCollectionRequest()
    for (let request of data) {
      await this.addCollectionRequestArchive(request.url, request.data)
    }
  }

  public async fillRequestFromRequestArchive() {
    const data = await this.getCollectionRequestArchive()
    for (let request of data) {
      await this.addCollectionRequest(request.url, JSON.parse(request.data))
    }
  }

  public async getCollectionRequestArchive() {
    const collection = await this.firestore.collection("requests_archive").get();
    return collection.docs.map((doc) => doc.data());
  }

  public async addCollectionRequestArchive(url: string, data: any) {
    const collection = await this.firestore.collection("requests_archive").add({
      url,
      data: JSON.stringify(data)
    });
    return collection;
  }

  public async updateCollectionRequest(url: string, data: any) {
    const collection = await this.firestore.collection("requests").where("url", "==", url).get();
    if (collection.docs.length === 0) return null;
    const doc = collection.docs[0];
    await doc.ref.update({
      data
    });
    return collection.docs.map((doc) => doc.data());
  }

  public async addCollectionLocation(city, latlng) {
    const collection = await this.firestore.collection("locations").add({
      city,
      latlng
    });
    return collection;
  }

  public async getCollectionLocationByCity(city: string) {
    const collection = await this.firestore.collection("locations").where("city", "==", city).get();
    if (collection.docs.length === 0) return null;
    return collection.docs.map((doc) => doc.data())[0].latlng;
  }
}

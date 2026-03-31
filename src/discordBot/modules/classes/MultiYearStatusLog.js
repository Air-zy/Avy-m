const HourlyStatusLog = require('./HourlyStatusLog.js')
class MultiYearStatusLog {
  constructor() {
    this.byYear = new Map();
  }

  getYearLog(year) {
    if (!this.byYear.has(year)) {
      this.byYear.set(year, HourlyStatusLog.fromYear(year));
    }
    return this.byYear.get(year);
  }

  set(date, isOnline) {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    this.getYearLog(year).set(d, isOnline);
  }

  get(date) {
    const d = new Date(date);
    const year = d.getUTCFullYear();
    return this.getYearLog(year).get(d);
  }

  serialize() {
    const years = {};
    for (const [year, log] of this.byYear) {
      years[year] = log.toJSON();
    }
    return JSON.stringify({ years });
  }

  static deserialize(input) {
    const obj = typeof input === "string" ? JSON.parse(input) : input;
    if (!obj || typeof obj !== "object" || !obj.years) {
      throw new TypeError("Invalid serialized data");
    }

    const wrapper = new MultiYearStatusLog();
    for (const [year, data] of Object.entries(obj.years)) {
      wrapper.byYear.set(Number(year), HourlyStatusLog.deserialize(data));
    }
    return wrapper;
  }
}

module.exports = MultiYearStatusLog
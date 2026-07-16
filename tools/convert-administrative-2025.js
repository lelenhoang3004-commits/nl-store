import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUT_PATH = path.resolve(__dirname, '../frontend/assets/data/vietnam-administrative-2025.js');
const SOURCE_JSON = path.resolve(__dirname, 'data/vietnam-administrative-2025-source.json');
const SOURCE_CSV = path.resolve(__dirname, 'data/vietnam-administrative-2025-source.csv');

function parseCsv(csvText) {
  const rows = [];
  let current = '';
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < csvText.length; i += 1) {
    const char = csvText[i];
    const next = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      row.push(current);
      current = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') {
        i += 1;
      }
      row.push(current);
      rows.push(row);
      row = [];
      current = '';
      continue;
    }

    current += char;
  }

  if (current !== '' || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows;
}

function normalizeString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function normalizeProvinceType(value) {
  const text = normalizeString(value);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower.includes('city') || lower.includes('thành phố') || lower.includes('municipality')) return 'city';
  if (lower.includes('province') || lower.includes('tỉnh')) return 'province';
  return lower === 'city' ? 'city' : 'province';
}

function normalizeWardType(value) {
  const text = normalizeString(value);
  if (!text) return null;
  const lower = text.toLowerCase();
  if (lower === 'ward' || lower.includes('phường')) return 'ward';
  if (lower === 'commune' || lower.includes('xã')) return 'commune';
  if (lower.includes('special_zone') || lower.includes('đặc khu') || lower.includes('special zone')) return 'special_zone';
  return 'ward';
}

function normalizeLocationName(record, fullKey, shortKey) {
  return normalizeString(record[fullKey]) || normalizeString(record[shortKey]) || null;
}

function buildData(records) {
  const provinces = new Map();

  records.forEach((record, index) => {
    const provinceCode = normalizeString(record.province_code || record.Code || record.code);
    const provinceName = normalizeLocationName(record, 'FullName', 'province_name') || normalizeLocationName(record, 'Name', 'name');
    const provinceType = normalizeProvinceType(record.province_type || record.Type || record.type || record.AdministrativeUnitShortName);
    const wardCode = normalizeString(record.ward_code || record.Code || record.code);
    const wardName = normalizeLocationName(record, 'FullName', 'ward_name') || normalizeLocationName(record, 'Name', 'name');
    const wardType = normalizeWardType(record.ward_type || record.Type || record.type || record.AdministrativeUnitShortName);

    if (!provinceCode || !provinceName || !provinceType || !wardCode || !wardName || !wardType) {
      throw new Error(`Invalid record at row ${index + 1}. All fields are required: province_code, province_name, province_type, ward_code, ward_name, ward_type`);
    }

    if (!provinces.has(provinceCode)) {
      provinces.set(provinceCode, {
        code: provinceCode,
        name: provinceName,
        type: provinceType,
        wards: []
      });
    }

    const province = provinces.get(provinceCode);
    province.wards.push({
      code: wardCode,
      name: wardName,
      type: wardType
    });
  });

  const data = Array.from(provinces.values()).map((province) => {
    const wardsByCode = new Map();
    province.wards.forEach((ward) => {
      const key = ward.code || `${ward.name}|${ward.type}`;
      wardsByCode.set(key, ward);
    });
    return {
      ...province,
      wards: Array.from(wardsByCode.values()).sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }))
    };
  });

  return data.sort((a, b) => a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' }));
}

function parseJsonSource(jsonData) {
  if (!Array.isArray(jsonData)) {
    throw new Error('Source JSON must be an array of address records or provinces.');
  }

  if (jsonData.length === 0) {
    return [];
  }

  const isProvinceWithWards = jsonData.every((item) => Array.isArray(item.Wards));
  if (isProvinceWithWards) {
    const records = [];
    jsonData.forEach((province) => {
      const provinceCode = normalizeString(province.Code || province.code || province.province_code);
      const provinceName = normalizeLocationName(province, 'FullName', 'Name') || normalizeLocationName(province, 'province_name', 'name');
      const provinceType = normalizeProvinceType(province.Type || province.type || province.province_type || province.AdministrativeUnitShortName);

      if (!provinceCode || !provinceName || !provinceType) {
        throw new Error('Invalid province record in JSON source. Each province must include Code, FullName/Name, and Type or AdministrativeUnitShortName.');
      }

      province.Wards.forEach((ward) => {
        records.push({
          province_code: provinceCode,
          province_name: provinceName,
          province_type: provinceType,
          ward_code: ward.Code || ward.code || ward.ward_code,
          ward_name: normalizeLocationName(ward, 'FullName', 'Name') || normalizeLocationName(ward, 'ward_name', 'name'),
          ward_type: normalizeWardType(ward.Type || ward.type || ward.ward_type || ward.AdministrativeUnitShortName)
        });
      });
    });
    return records;
  }

  const hasFlatProvinceFields = jsonData.every((item) => item.province_code || item.Code || item.code);
  if (hasFlatProvinceFields) {
    return jsonData.map((item, index) => ({
      province_code: item.province_code || item.Code || item.code,
      province_name: normalizeLocationName(item, 'province_name', 'Name') || normalizeLocationName(item, 'FullName', 'name'),
      province_type: normalizeProvinceType(item.province_type || item.Type || item.type || item.AdministrativeUnitShortName),
      ward_code: item.ward_code || item.Code || item.code,
      ward_name: normalizeLocationName(item, 'ward_name', 'Name') || normalizeLocationName(item, 'FullName', 'name'),
      ward_type: normalizeWardType(item.ward_type || item.Type || item.type || item.AdministrativeUnitShortName)
    }));
  }

  throw new Error('Unsupported JSON structure. JSON source must be a province list with Wards or a flat list of address records.');
}

function writeOutput(data) {
  const jsContent = `/**\n` +
    ` * Generated Vietnam administrative data for 2025.\n` +
    ` *\n` +
    ` * WARNING: This file is generated from tools/data/vietnam-administrative-2025-source.json or .csv.\n` +
    ` * Do not edit directly.\n` +
    ` */\n\n` +
    `export const VIETNAM_ADMINISTRATIVE_2025 = ${JSON.stringify(data, null, 2)};\n`;

  fs.writeFileSync(OUTPUT_PATH, jsContent, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);

  const totalProvinces = data.length;
  const totalWards = data.reduce((sum, province) => sum + province.wards.length, 0);
  const canTho = data.find((province) => province.name.toLowerCase().includes('cần thơ') || province.code === '92');
  const hoChiMinh = data.find((province) => province.name.toLowerCase().includes('hồ chí minh') || province.code === '79');

  console.log(`Total provinces: ${totalProvinces}`);
  console.log(`Total wards: ${totalWards}`);
  console.log(`Thành phố Cần Thơ: ${canTho ? canTho.wards.length : 0} wards`);
  console.log(`Thành phố Hồ Chí Minh: ${hoChiMinh ? hoChiMinh.wards.length : 0} wards`);
}

function run() {
  let sourcePath;
  let rawData;

  if (fs.existsSync(SOURCE_JSON)) {
    sourcePath = SOURCE_JSON;
    rawData = fs.readFileSync(SOURCE_JSON, 'utf8');
    const parsed = JSON.parse(rawData);
    const records = parseJsonSource(parsed);
    const data = buildData(records);
    writeOutput(data);
    return;
  }

  if (fs.existsSync(SOURCE_CSV)) {
    sourcePath = SOURCE_CSV;
    rawData = fs.readFileSync(SOURCE_CSV, 'utf8');
    const rows = parseCsv(rawData).filter((row) => row.length && row.some((cell) => String(cell).trim()));
    if (rows.length < 2) {
      throw new Error('CSV source must include a header row plus at least one data row.');
    }

    const header = rows[0].map((name) => String(name).trim());
    const required = ['province_code', 'province_name', 'province_type', 'ward_code', 'ward_name', 'ward_type'];
    required.forEach((field) => {
      if (!header.includes(field)) {
        throw new Error(`Missing required CSV header: ${field}`);
      }
    });

    const records = rows.slice(1).map((row, rowIndex) => {
      const record = {};
      header.forEach((name, index) => {
        record[name] = row[index];
      });
      return record;
    });

    const data = buildData(records);
    writeOutput(data);
    return;
  }

  throw new Error(`No source file found. Create either ${SOURCE_JSON} or ${SOURCE_CSV} with official administrative data.`);
}

try {
  run();
} catch (error) {
  console.error('Error:', error.message || error);
  process.exit(1);
}

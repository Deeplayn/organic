require('../api/_env');

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured. Add it to .env before running the export.');
  }

  const client = new Client({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined
  });

  await client.connect();

  try {
    const tables = await getPublicTables(client);
    if (!tables.length) {
      throw new Error('No public tables were found to export.');
    }

    const workbookXml = await buildWorkbookXml(client, tables, connectionString);
    const exportDir = path.resolve(__dirname, '..', 'exports');
    fs.mkdirSync(exportDir, { recursive: true });

    const filePath = path.join(exportDir, `organic-admin-export-${buildTimestamp()}.xml`);
    fs.writeFileSync(filePath, workbookXml, 'utf8');

    console.log(`Export complete: ${filePath}`);
    console.log(`Tables exported: ${tables.join(', ')}`);
  } finally {
    await client.end();
  }
}

async function getPublicTables(client) {
  const result = await client.query(`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `);

  return result.rows.map(row => String(row.tablename || '').trim()).filter(Boolean);
}

async function buildWorkbookXml(client, tables, connectionString) {
  const exportedAt = new Date().toISOString();
  const workbookParts = [
    '<?xml version="1.0"?>',
    '<?mso-application progid="Excel.Sheet"?>',
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"',
    ' xmlns:o="urn:schemas-microsoft-com:office:office"',
    ' xmlns:x="urn:schemas-microsoft-com:office:excel"',
    ' xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">',
    ' <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">',
    '  <Author>OrganoChem Admin Export</Author>',
    `  <Created>${escapeXml(exportedAt)}</Created>`,
    ' </DocumentProperties>',
    ' <Styles>',
    '  <Style ss:ID="Default" ss:Name="Normal">',
    '   <Alignment ss:Vertical="Top" ss:WrapText="1"/>',
    '  </Style>',
    '  <Style ss:ID="Header">',
    '   <Font ss:Bold="1"/>',
    '   <Interior ss:Color="#D9EAD3" ss:Pattern="Solid"/>',
    '  </Style>',
    ' </Styles>',
    buildMetaWorksheet(exportedAt, connectionString, tables)
  ];

  for (const tableName of tables) {
    const rows = await fetchTableRows(client, tableName);
    workbookParts.push(buildTableWorksheet(tableName, rows));
  }

  workbookParts.push('</Workbook>');
  return workbookParts.join('\n');
}

function buildMetaWorksheet(exportedAt, connectionString, tables) {
  const safeConnection = maskConnectionString(connectionString);
  const rows = [
    ['Exported At', exportedAt],
    ['Connection', safeConnection],
    ['Table Count', String(tables.length)],
    ['Tables', tables.join(', ')]
  ];

  return [
    ' <Worksheet ss:Name="export_meta">',
    '  <Table>',
    ...rows.map(buildSimpleRow),
    '  </Table>',
    ' </Worksheet>'
  ].join('\n');
}

async function fetchTableRows(client, tableName) {
  const sql = `SELECT * FROM ${quoteIdentifier(tableName)} ORDER BY 1 NULLS FIRST`;
  const result = await client.query(sql);
  return result.rows;
}

function buildTableWorksheet(tableName, rows) {
  const sheetName = sanitizeSheetName(tableName);
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const xmlRows = [];

  if (columns.length) {
    xmlRows.push(buildHeaderRow(columns));
    for (const row of rows) {
      xmlRows.push(buildDataRow(columns.map(column => row[column])));
    }
  } else {
    xmlRows.push(buildSimpleRow(['Status', 'No rows found in this table at export time.']));
  }

  return [
    ` <Worksheet ss:Name="${escapeXml(sheetName)}">`,
    '  <Table>',
    ...xmlRows,
    '  </Table>',
    ' </Worksheet>'
  ].join('\n');
}

function buildHeaderRow(columns) {
  return [
    '   <Row>',
    ...columns.map(column => `    <Cell ss:StyleID="Header"><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`),
    '   </Row>'
  ].join('\n');
}

function buildDataRow(values) {
  return [
    '   <Row>',
    ...values.map(value => buildCell(value)),
    '   </Row>'
  ].join('\n');
}

function buildSimpleRow(entries) {
  return [
    '   <Row>',
    ...entries.map(value => `    <Cell><Data ss:Type="String">${escapeXml(String(value || ''))}</Data></Cell>`),
    '   </Row>'
  ].join('\n');
}

function buildCell(value) {
  if (value === null || value === undefined) {
    return '    <Cell/>';
  }

  const normalized = normalizeCellValue(value);
  return `    <Cell><Data ss:Type="String">${escapeXml(normalized)}</Data></Cell>`;
}

function normalizeCellValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }

  if (typeof value === 'object') {
    return JSON.stringify(value);
  }

  return String(value);
}

function sanitizeSheetName(value) {
  return String(value || 'sheet')
    .replace(/[:\\/?*\[\]]/g, '_')
    .slice(0, 31) || 'sheet';
}

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function shouldUseSsl(connectionString) {
  return !/localhost|127\.0\.0\.1/i.test(connectionString);
}

function maskConnectionString(connectionString) {
  return String(connectionString || '').replace(/\/\/([^:/?#]+):([^@]+)@/, '//$1:***@');
}

main().catch(error => {
  console.error(error.message || String(error));
  process.exit(1);
});

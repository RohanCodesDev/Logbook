import { toField } from '../controllers/fieldsController.js';

export const CURRENCY_NAME_RE = /\b(rate|amount|price|cost|bill|wage|salary|fee|total|budget|spend|expense|payable)\b/i;
export const PRIMARY_TOTAL_NAME_RE = /\b(amount|total|cost|spend|expense|bill|payable|net)\b/i;

export function parseNumeric(raw) {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  const cleaned = String(raw).replace(/[₹,\s]/g, '').trim();
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function evalFieldNumeric(field, rowData, fieldById, visited = new Set()) {
  if (!field || !rowData) return null;
  if (field.field_type !== 'formula') {
    return parseNumeric(rowData[String(field.id)]);
  }
  if (!field.formula || visited.has(field.id)) return null;
  const { leftFieldId, operator = 'mul', rightFieldId } = field.formula;
  const leftField = fieldById.get(Number(leftFieldId));
  const rightField = fieldById.get(Number(rightFieldId));
  if (!leftField || !rightField) return null;

  const nextVisited = new Set(visited);
  nextVisited.add(field.id);

  const l = evalFieldNumeric(leftField, rowData, fieldById, nextVisited);
  const r = evalFieldNumeric(rightField, rowData, fieldById, nextVisited);
  if (l === null || r === null) return null;

  switch (operator) {
    case 'add': return l + r;
    case 'sub': return l - r;
    case 'div': return r === 0 ? null : l / r;
    case 'mul':
    default:    return l * r;
  }
}

export function pickSpendField(fields = []) {
  const formulaCurrency = fields.filter(
    (f) => f.field_type === 'formula' && f.formula?.format === 'currency'
  );
  if (formulaCurrency.length) {
    return formulaCurrency.find((f) => PRIMARY_TOTAL_NAME_RE.test(f.name)) || formulaCurrency[0];
  }

  const totalNamed = fields.find(
    (f) =>
      PRIMARY_TOTAL_NAME_RE.test(f.name) &&
      (f.field_type === 'currency' || f.field_type === 'number' || f.field_type === 'formula' || f.field_type === 'text')
  );
  if (totalNamed) return totalNamed;

  const anyCurrency = fields.find((f) => f.field_type === 'currency');
  if (anyCurrency) return anyCurrency;

  return fields.find(
    (f) =>
      CURRENCY_NAME_RE.test(f.name) &&
      (f.field_type === 'number' || f.field_type === 'text' || f.field_type === 'formula')
  ) || null;
}

export function pickEntryLabel(secFields = [], rowData = {}, spendField = null) {
  for (const f of secFields) {
    if (spendField && f.id === spendField.id) continue;
    if (f.field_type !== 'text' && f.field_type !== 'select') continue;
    const raw = rowData?.[String(f.id)];
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      return String(raw).trim();
    }
  }
  return '';
}

export const PRESET_SHEET_DEFINITIONS = {
  machines: {
    name: 'Machines',
    fields: [
      { name: 'Machine', fieldType: 'text', isRequired: true },
      { name: 'Hours', fieldType: 'number' },
      { name: 'Rate', fieldType: 'currency' },
      { name: 'Total', fieldType: 'formula', formulaRef: { leftIndex: 1, operator: 'mul', rightIndex: 2, format: 'currency' } },
      { name: 'Operator', fieldType: 'text' },
    ],
  },
  hyvas: {
    name: 'Hyvas',
    fields: [
      { name: 'Hyva', fieldType: 'text', isRequired: true },
      { name: 'Trips', fieldType: 'number' },
      { name: 'Rate', fieldType: 'currency' },
      { name: 'Total', fieldType: 'formula', formulaRef: { leftIndex: 1, operator: 'mul', rightIndex: 2, format: 'currency' } },
      { name: 'Driver', fieldType: 'text' },
    ],
  },
  materials: {
    name: 'Materials',
    fields: [
      { name: 'Material', fieldType: 'text', isRequired: true },
      { name: 'Qty', fieldType: 'number' },
      { name: 'Unit', fieldType: 'select', options: ['Bags', 'Tons', 'Pcs', 'Brass', 'Kg', 'Liters'] },
      { name: 'Rate', fieldType: 'currency' },
      { name: 'Total', fieldType: 'formula', formulaRef: { leftIndex: 1, operator: 'mul', rightIndex: 3, format: 'currency' } },
      { name: 'Vendor', fieldType: 'text' },
    ],
  },
  labour: {
    name: 'Daily Labor',
    fields: [
      { name: 'Worker / Team', fieldType: 'text', isRequired: true },
      { name: 'Days / Count', fieldType: 'number' },
      { name: 'Wage Rate', fieldType: 'currency' },
      { name: 'Total', fieldType: 'formula', formulaRef: { leftIndex: 1, operator: 'mul', rightIndex: 2, format: 'currency' } },
      { name: 'Work Done', fieldType: 'text' },
    ],
  },
  expenses: {
    name: 'Expenses',
    fields: [
      { name: 'Item', fieldType: 'text', isRequired: true },
      { name: 'Category', fieldType: 'select', options: ['Materials', 'Labour', 'Transport', 'Fuel', 'Other'] },
      { name: 'Amount', fieldType: 'currency' },
      { name: 'Paid By', fieldType: 'text' },
      { name: 'Notes', fieldType: 'text' },
    ],
  },
};

/**
 * Shared transactional helper to create a project section with custom fields & relative formulas.
 */
export async function insertSectionWithFields(client, projectId, {
  name,
  description = null,
  icon = 'folder',
  models = [],
  fields = [],
  sortOrder = null,
}) {
  let nextOrder = sortOrder;
  if (nextOrder === null || nextOrder === undefined) {
    const { rows: orderRows } = await client.query(
      'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM project_sections WHERE project_id = $1',
      [projectId]
    );
    nextOrder = orderRows[0].next_order;
  }

  const cleanModels = Array.isArray(models)
    ? Array.from(new Set(models.map((m) => String(m || '').trim()).filter(Boolean)))
    : [];

  const { rows: secRows } = await client.query(
    `INSERT INTO project_sections (project_id, name, description, icon, models, sort_order)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING *`,
    [projectId, name.trim(), description?.trim() || null, icon, JSON.stringify(cleanModels), nextOrder]
  );
  const section = secRows[0];

  const createdFields = [];
  const createdIdsByIndex = {};
  const validFieldInputs = [];

  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f.name || !f.name.trim()) continue;
    const sortIdx = validFieldInputs.length;
    validFieldInputs.push({ raw: f, origIndex: i, sortIdx });

    const { rows: fRows } = await client.query(
      `INSERT INTO section_fields (section_id, name, field_type, options, is_required, sort_order)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING *`,
      [
        section.id,
        f.name.trim(),
        f.fieldType || 'text',
        JSON.stringify(Array.isArray(f.options) ? f.options : []),
        f.fieldType === 'formula' ? false : Boolean(f.isRequired),
        sortIdx,
      ]
    );
    createdIdsByIndex[i] = fRows[0].id;
    createdFields.push(toField(fRows[0]));
  }

  for (const item of validFieldInputs) {
    const { raw, sortIdx } = item;
    if (raw.fieldType === 'formula' && raw.formulaRef) {
      const leftId = createdIdsByIndex[raw.formulaRef.leftIndex];
      const rightId = createdIdsByIndex[raw.formulaRef.rightIndex];
      if (leftId && rightId) {
        const formulaObj = {
          leftFieldId: leftId,
          operator: raw.formulaRef.operator || 'mul',
          rightFieldId: rightId,
          format: raw.formulaRef.format || 'currency',
        };
        const { rows: updRows } = await client.query(
          `UPDATE section_fields SET formula = $1::jsonb WHERE id = $2 RETURNING *`,
          [JSON.stringify(formulaObj), createdFields[sortIdx].id]
        );
        if (updRows.length) {
          createdFields[sortIdx] = toField(updRows[0]);
        }
      }
    }
  }

  return { section, fields: createdFields };
}

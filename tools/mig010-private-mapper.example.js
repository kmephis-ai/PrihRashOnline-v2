'use strict';

/**
 * PUBLIC-SAFE TEMPLATE ONLY.
 *
 * Copy this file OUTSIDE the Git repository before configuring it.
 * Never put real sheet names, headers, account/category mappings or values
 * into the tracked example.
 */
module.exports = {
  schema: 'MIG010_OWNER_PRIVATE_MAPPER_V1',
  mappingVersion: 'OWNER-PRIVATE-MAPPING-v1',

  buildSnapshot({ backupPackage, cellValue }) {
    if (!backupPackage || backupPackage.format !== 'PRH_PORTABLE_BACKUP_V1') {
      throw new Error('MIG010_PRIVATE_BACKUP_FORMAT_INVALID');
    }
    if (typeof cellValue !== 'function') {
      throw new Error('MIG010_PRIVATE_CELL_VALUE_REQUIRED');
    }

    // The owner-local copy must:
    // 1. locate the private source-history sheet(s) by owner-private config;
    // 2. convert every source row to DATA-001 SOURCE-TRANSFORM-v1 records;
    // 3. locate the current canonical target representation;
    // 4. convert target rows to PRH_CANONICAL_TRANSACTION_V1;
    // 5. preserve source provenance/fingerprint semantics;
    // 6. fail closed on unknown headers, unresolved dimensions or invalid rows.
    //
    // Do not guess mappings. Do not silently skip rows.
    throw new Error('MIG010_PRIVATE_MAPPER_NOT_CONFIGURED');
  }
};

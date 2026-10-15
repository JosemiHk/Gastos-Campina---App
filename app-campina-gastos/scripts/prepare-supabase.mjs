import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const migrationsDirectory = new URL('../../supabase/migrations/', import.meta.url);
const destinationDirectory = new URL('../../supabase/.temp/', import.meta.url);
const migrations = readdirSync(migrationsDirectory)
  .filter((name) => name.endsWith('.sql'))
  .sort();
if (!migrations.length) throw new Error('No se encontraron migraciones.');

const contents = [
  '-- Campiña Gastos: instalación inicial mediante Supabase SQL Editor.',
  '-- Ejecutar una sola vez, únicamente sobre el proyecto nuevo y vacío.',
  '-- No contiene contraseñas, claves, cuentas bancarias ni recibos reales.',
  '-- Si falla una instrucción, la transacción revierte toda la instalación.',
  'begin;',
  ...migrations.map(
    (name) =>
      `\n-- Fuente: supabase/migrations/${name}\n${readFileSync(new URL(name, migrationsDirectory), 'utf8')}`,
  ),
  '\ncommit;\n',
].join('\n');

mkdirSync(destinationDirectory, { recursive: true });
writeFileSync(new URL('setup-campina.sql', destinationDirectory), contents);
console.log(`Preparadas ${migrations.length} migraciones en supabase/.temp/setup-campina.sql.`);

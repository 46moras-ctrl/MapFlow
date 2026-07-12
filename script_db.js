const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('/Users/karen/MapFlow/.env', 'utf8');
const SUPABASE_URL = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1];
const SUPABASE_KEY = envFile.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1];

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data: empresas, error } = await supabase.from('empresas').select('*');
  console.log('Empresas:', empresas);
  
  if (error) {
    console.error('Error:', error);
  } else {
    for (const emp of empresas) {
      console.log(`\nEmpresa: ${emp.nombre} (ID: ${emp.id})`);
      const { count: facturas } = await supabase.from('facturas').select('*', { count: 'exact', head: true }).eq('id_empresa', emp.id);
      const { count: movs } = await supabase.from('movimientos').select('*', { count: 'exact', head: true }).eq('id_empresa', emp.id);
      const { count: planes } = await supabase.from('planes_pago').select('*', { count: 'exact', head: true }).eq('id_empresa', emp.id);
      const { count: pres } = await supabase.from('presupuestos').select('*', { count: 'exact', head: true }).eq('id_empresa', emp.id);
      
      console.log(`- Facturas: ${facturas}`);
      console.log(`- Movimientos: ${movs}`);
      console.log(`- Planes de pago: ${planes}`);
      console.log(`- Presupuestos: ${pres}`);
    }
  }
}

main();

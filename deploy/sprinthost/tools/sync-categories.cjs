const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname,'../../..');
process.chdir(root);
Object.assign(process.env, JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/tizavi/env.json'),'utf8')));
import('tsx/esm/api').then(async ({tsImport})=>{
 const {syncMoyskladCategories} = await tsImport('./api/_moysklad-categories.ts',pathToFileURL(path.join(root,'app.cjs')).href);
 const {pool} = await tsImport('./api/_db.ts',pathToFileURL(path.join(root,'app.cjs')).href);
 try { console.log(JSON.stringify(await syncMoyskladCategories(false,true))); }
 catch { console.error('Category sync failed; see owner integration settings');process.exitCode=1; }
 finally { await pool.end(); }
}).catch(()=>{console.error('Category sync startup failed');process.exitCode=1;});

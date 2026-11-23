const v = require('gltf-validator'), fs = require('fs');
const f = process.argv[2];
v.validateBytes(new Uint8Array(fs.readFileSync(f)), { maxIssues: 50 }).then((r) => {
  console.log(JSON.stringify({ errors: r.issues.numErrors, warnings: r.issues.numWarnings, infos: r.issues.numInfos,
    messages: r.issues.messages.filter((m) => m.severity <= 1).map((m) => m.code + ' ' + m.pointer) }));
});

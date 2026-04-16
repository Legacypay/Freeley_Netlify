const { marked } = require('marked');
console.log('Type of marked:', typeof marked);
if (marked) {
    console.log('Keys of marked:', Object.keys(marked));
    console.log('Type of marked.parse:', typeof marked.parse);
}
const m2 = require('marked');
console.log('Type of require(marked):', typeof m2);
if (m2) {
    console.log('Keys of require(marked):', Object.keys(m2));
    console.log('Type of require(marked).parse:', typeof m2.parse);
}

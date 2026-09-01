const { test } = require('node:test');
const assert = require('node:assert/strict');

const { billingModelFor, normalizeCompound } = require('../../netlify/functions/lib/billing-model');

const cfg = (billing) => ({ billing });

test('normalizeCompound maps every alias checkout/quiz can send onto one product key', () => {
  assert.equal(normalizeCompound('semaglutide'), 'sema');
  assert.equal(normalizeCompound('SEMA'), 'sema');
  assert.equal(normalizeCompound('tirzepatide'), 'tirz');
  assert.equal(normalizeCompound('tirz'), 'tirz');
  assert.equal(normalizeCompound('olympus-max'), 'olympus');
  assert.equal(normalizeCompound('nad+'), 'nad-plus');
  assert.equal(normalizeCompound('nad-plus'), 'nad-plus');
  assert.equal(normalizeCompound('tadalafil-daily'), 'tadalafil-daily');
  assert.equal(normalizeCompound(undefined), '');
});

test('_default applies when nothing is listed', () => {
  assert.equal(billingModelFor('hair-loss', undefined, cfg({ _default: 'subscription' })), 'subscription');
  assert.equal(billingModelFor('hair-loss', undefined, cfg({ _default: 'one-time' })), 'one-time');
  assert.equal(billingModelFor('hair-loss', undefined, cfg({})), 'subscription'); // unknown default → subscription
  assert.equal(billingModelFor('hair-loss', undefined, {}), 'subscription'); // no billing block at all
});

test('a whole treatment can be one-time', () => {
  const p = cfg({ _default: 'subscription', one_time: ['longevity'] });
  assert.equal(billingModelFor('longevity', 'nad-plus', p), 'one-time');
  assert.equal(billingModelFor('longevity', undefined, p), 'one-time');
  assert.equal(billingModelFor('weight-loss', 'sema', p), 'subscription');
});

test('treatment:compound beats treatment, and aliases resolve to the same entry', () => {
  const p = cfg({ _default: 'subscription', one_time: ['longevity'], subscription: ['longevity:sermorelin-injectable', 'sexual-wellness:olympus'] });
  assert.equal(billingModelFor('longevity', 'sermorelin-injectable', p), 'subscription');
  assert.equal(billingModelFor('longevity', 'glutathione-troche', p), 'one-time');
  assert.equal(billingModelFor('sexual-wellness', 'olympus-peak', p), 'subscription');
  const q = cfg({ _default: 'subscription', one_time: ['weight-loss:tirz'] });
  assert.equal(billingModelFor('weight-loss', 'tirzepatide', q), 'one-time');
  assert.equal(billingModelFor('weight-loss', 'semaglutide', q), 'subscription');
});

test('the real pricing.json parses and every listed id is a known treatment[:compound]', () => {
  const pricing = require('../../pricing.json');
  const treatments = new Set(Object.keys(pricing).filter((k) => !k.startsWith('_') && !['billing', 'promos', 'treatment_names'].includes(k)));
  const compounds = new Set(['sema', 'tirz', 'tadalafil-daily', 'olympus', 'sermorelin-injectable', 'nad-plus', 'glutathione-troche']);
  const ids = [...(pricing.billing.one_time || []), ...(pricing.billing.subscription || [])];
  for (const id of ids) {
    const [t, c] = id.split(':');
    assert.ok(treatments.has(t), `${id}: unknown treatment ${t}`);
    if (c !== undefined) assert.ok(compounds.has(c), `${id}: unknown compound ${c}`);
  }
  assert.ok(['subscription', 'one-time'].includes(pricing.billing._default));
  // Sanity: the resolver runs against the shipped file without throwing.
  assert.ok(['subscription', 'one-time'].includes(billingModelFor('hair-loss')));
});

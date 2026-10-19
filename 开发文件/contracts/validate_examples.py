"""Validate interface examples. Requires jsonschema; does not call application APIs."""
import json
from pathlib import Path
from decimal import Decimal
from jsonschema import Draft202012Validator, FormatChecker

root = Path(__file__).resolve().parent.parent
api = json.loads((root / 'contracts/openapi.json').read_text(encoding='utf-8'))
schemas = api['components']['schemas']
for name, schema in schemas.items():
    Draft202012Validator.check_schema(schema)

def check_refs(node):
    if isinstance(node, dict):
        if '$ref' in node:
            value = node['$ref']
            assert value.startswith('#/components/schemas/') and value.split('/')[-1] in schemas, value
        for child in node.values():
            check_refs(child)
    elif isinstance(node, list):
        for child in node:
            check_refs(child)

check_refs(api)
seen = set()
for path, operations in api['paths'].items():
    for method, op in operations.items():
        assert op['operationId'] not in seen
        seen.add(op['operationId'])
        placeholders = {s[1:-1] for s in path.split('/') if s.startswith('{')}
        assert placeholders == {p['name'] for p in op.get('parameters', []) if p['in'] == 'path'}

mapping = json.loads((root / 'examples/schema-map.json').read_text(encoding='utf-8'))
for filename, name in mapping.items():
    example = json.loads((root / 'examples' / filename).read_text(encoding='utf-8'))
    wrapper = {'$schema': 'https://json-schema.org/draft/2020-12/schema', '$ref': '#/components/schemas/' + name, 'components': api['components']}
    Draft202012Validator(wrapper, format_checker=FormatChecker()).validate(example)
    print('PASS ' + filename)

request = json.loads((root / 'examples/calculation-request.json').read_text(encoding='utf-8'))
result = json.loads((root / 'examples/calculation-response.json').read_text(encoding='utf-8'))['data']
def recalculate(leg):
    revenue = sum(Decimal(x['unit_price'])*Decimal(x['quantity'])-Decimal(x['discount']) for x in leg['revenue_lines'])
    material = sum(Decimal(x['quantity'])*Decimal(x['weighted_price'])/(1-Decimal(x['loss_rate'])) if leg['material_basis']=='bom' else Decimal(x['quantity'])*Decimal(x['weighted_price']) for x in leg['materials'])
    labor = sum(Decimal(x['piece_rate'])*Decimal(x['payable_quantity']) for x in leg['labor'])
    manufacturing = sum(Decimal(x['amount']) for x in leg['manufacturing_allocations'])
    expense = {cat:sum(Decimal(x['amount']) for x in leg['expenses'] if x['category']==cat) for cat in ('other_production','management','sales','finance')}
    gp = revenue-material-labor-manufacturing-expense['other_production']
    return revenue, gp, gp/revenue, gp-expense['management']-expense['sales']-expense['finance']
for label in ('expected','actual'):
    revenue,gp,rate,np = recalculate(request[label])
    target = result[label]
    assert revenue == Decimal(target['revenue'])
    assert gp == Decimal(target['gross_profit'])
    assert rate == Decimal(target['gross_margin'])
    assert np == Decimal(target['management_profit'])
assert result['actual']['final_profit'] is None
assert Decimal(result['comparison']['profit_delta']) == Decimal('-680')
assert sum(Decimal(x['delta']) for x in result['comparison']['cost_variances']) == Decimal('680')
evidence_ids = {x['evidence_id'] for x in result['evidence']}
assistant = json.loads((root / 'examples/assistant-response.json').read_text(encoding='utf-8'))['data']
for fact in assistant['result']['fact_refs']:
    assert fact['snapshot_id'] == result['snapshot_id'] and fact['evidence_id'] in evidence_ids
assert assistant['provider'] == 'mock' and assistant['result']['reviewed'] is False
print(f'PASS {len(schemas)} schemas, {len(seen)} operations; references, paths, arithmetic and AI evidence checked')

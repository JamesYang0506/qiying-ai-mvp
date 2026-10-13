import copy
import unittest
from profit_model.engine import calculate


def fixture():
    return {
        'metadata': {'is_demo': True, 'currency': 'CNY', 'cutoff_date': '2026-09-30','management_enabled':True},
        'orders': [{'order_id': 'A', 'product': '演示鞋底', 'customer': '演示客户',
                    'quantity': '1000', 'unit': '双', 'unit_price': '20', 'discount': '200',
                    'mode': 'forecast', 'scope_aligned': True}],
        'materials': [{'record_id': 'm1', 'order_id': 'A', 'quantity': '300', 'unit_price': '20',
                       'method': 'bom', 'loss_rate': '0.04', 'loss_definition': 'input',
                       'status': 'confirmed', 'stage': 'inside', 'period': '2026-09'}],
        'labor': [{'record_id': 'l1', 'order_id': 'A', 'quantity': '1000', 'rate': '2.5',
                   'status': 'confirmed', 'stage': 'inside', 'period': '2026-09'}],
        'costs': [],
        'pools': [{'pool_id': 'p'+str(n), 'category': cat, 'period': '2026-09', 'amount': amount,
                   'total_base': base, 'base_unit': unit, 'status': 'confirmed',
                   'direct_cost_excluded': True, 'stage': 'inside'}
                  for n, cat, amount, base, unit in [(1,'manufacturing','50000','1000','h'),
                  (2,'management','10000','10000','双'),(3,'sales','5000','10000','双'),
                  (4,'finance','2000','10000','双')]],
        'bases': [{'pool_id': 'p'+str(n), 'order_id': 'A', 'base': '100' if n==1 else '1000'} for n in range(1,5)],
        'coverage': [{'order_id': 'A', 'category': c, 'status': 'confirmed' if c in
                     ['material','labor','manufacturing','management','sales','finance'] else 'not_applicable'}
                     for c in ['material','labor','manufacturing','production_other','management','sales','finance','order_other']]
    }


class EngineTests(unittest.TestCase):
    def test_hand_calculated_order(self):
        r = calculate(fixture())['orders'][0]
        self.assertEqual((r['revenue'],r['production_profit'],r['management_profit']), ('19800.00','6050.00','4350.00'))
        self.assertEqual(r['production_margin'], '0.305556')
        self.assertEqual(r['production_status'], 'estimated')

    def test_actual_material_does_not_add_loss(self):
        d=fixture(); d['materials'][0].update(method='actual',quantity='300')
        self.assertEqual(calculate(d)['orders'][0]['categories']['material'], '6000.00')
        self.assertEqual(calculate(d)['orders'][0]['production_status'],'complete')

    def test_missing_finance_only_blocks_management_layer(self):
        d=fixture(); d['pools']=d['pools'][:-1]; d['bases']=d['bases'][:-1]
        d['coverage'][-2]['status']='missing'
        r=calculate(d)['orders'][0]
        self.assertEqual(r['production_profit'],'6050.00')
        self.assertIsNone(r['management_profit'])
        self.assertEqual(r['management_status'],'blocked')

    def test_missing_amount_not_zero(self):
        d=fixture(); d['materials'][0]['quantity']=None
        r=calculate(d)['orders'][0]
        self.assertIsNone(r['production_profit'])
        self.assertIsNone(r['categories']['material'])

    def test_duplicate_record_is_rejected(self):
        d=fixture(); d['materials'].append(copy.deepcopy(d['materials'][0]))
        with self.assertRaises(ValueError): calculate(d)

    def test_orphan_cost_is_rejected(self):
        d=fixture(); d['materials'][0]['order_id']='UNKNOWN'
        with self.assertRaises(ValueError): calculate(d)

    def test_zero_pool_denominator_blocks_profit(self):
        d=fixture(); d['pools'][0]['total_base']='0'; d['bases'][0]['base']='0'
        r=calculate(d)['orders'][0]
        self.assertIsNone(r['production_profit'])

    def test_partial_scope_pool_has_unallocated_balance(self):
        a=calculate(fixture())['allocations'][0]
        self.assertEqual(a['amount'],'5000.00')
        self.assertEqual(a['unallocated'],'45000.00')

    def test_cross_period_allocations_are_added(self):
        d=fixture(); p=copy.deepcopy(d['pools'][0]); p.update(pool_id='next',period='2026-08',amount='10000')
        d['pools'].append(p); d['bases'].append({'pool_id':'next','order_id':'A','base':'100'})
        self.assertEqual(calculate(d)['orders'][0]['categories']['manufacturing'],'6000.00')

    def test_estimates_propagate(self):
        d=fixture(); d['materials'][0]['status']='estimated'
        self.assertEqual(calculate(d)['orders'][0]['production_status'],'estimated')

    def test_zero_revenue_has_null_margin(self):
        d=fixture(); d['orders'][0].update(unit_price='0',discount='0')
        self.assertIsNone(calculate(d)['orders'][0]['production_margin'])

    def test_nonfinite_and_loss_one_rejected(self):
        for changes in [{'quantity':'NaN'},{'loss_rate':'1'}]:
            d=fixture(); d['materials'][0].update(changes)
            with self.assertRaises(ValueError): calculate(d)

    def test_unaligned_scope_blocks_all_profits(self):
        d=fixture(); d['orders'][0]['scope_aligned']=False
        self.assertIsNone(calculate(d)['orders'][0]['production_profit'])

    def test_not_applicable_cannot_hide_nonzero_cost(self):
        d=fixture(); d['coverage'][0]['status']='not_applicable'
        with self.assertRaises(ValueError): calculate(d)

    def test_full_allocation_rounding_conserves_pool(self):
        d=fixture(); d['pools']=d['pools'][:1]; d['pools'][0].update(amount='100',total_base='3')
        d['orders']=[dict(d['orders'][0],order_id=x) for x in ['A','B','C']]
        d['materials']=[]; d['labor']=[]; d['coverage']=[]
        d['bases']=[{'pool_id':'p1','order_id':x,'base':'1'} for x in ['A','B','C']]
        a=calculate(d)['allocations']
        self.assertEqual([x['amount'] for x in a],['33.33','33.33','33.34'])
        self.assertEqual(a[-1]['unallocated'],'0.00')

    def test_displayed_cost_records_equal_category_and_profit(self):
        d=fixture(); d['materials']=[dict(d['materials'][0],record_id=x,method='actual',quantity='1',unit_price='0.005') for x in ['a','b']]
        r=calculate(d)
        self.assertEqual(r['orders'][0]['categories']['material'],'0.02')
        self.assertEqual(r['orders'][0]['production_profit'],'12299.98')

    def test_tiny_pools_never_allocate_negative_amounts_or_balance(self):
        from decimal import Decimal
        for amount,denom,want in [('0.02','4','0.02'),('0.03','5','0.02')]:
            d=fixture(); d['pools']=d['pools'][:1]; d['pools'][0].update(amount=amount,total_base=denom)
            d['orders']=[dict(d['orders'][0],order_id=x) for x in ['A','B','C','D']]
            d['materials']=[]; d['labor']=[]; d['coverage']=[]
            d['bases']=[{'pool_id':'p1','order_id':x,'base':'1'} for x in ['A','B','C','D']]
            a=calculate(d)['allocations']
            self.assertTrue(all(Decimal(x['amount'])>=0 for x in a))
            self.assertTrue(all(Decimal(x['unallocated'])>=0 for x in a))
            self.assertEqual(sum(Decimal(x['amount']) for x in a),Decimal(want))

    def test_excessively_small_numeric_scale_is_rejected(self):
        d=fixture();d['orders'][0].update(quantity='1e-1000000',unit_price='1e-1000000',discount='0')
        with self.assertRaises(ValueError):calculate(d)

    def test_management_module_disabled_by_default(self):
        d=fixture();del d['metadata']['management_enabled']
        r=calculate(d)['orders'][0]
        self.assertIsNone(r['management_profit'])
        self.assertEqual(r['management_status'],'disabled')
        self.assertEqual(r['production_profit'],'6050.00')

    def test_unconfirmed_tax_marks_revenue_and_profit_estimated(self):
        d=fixture();d['materials'][0]['method']='actual';d['orders'][0]['revenue_status']='estimated'
        r=calculate(d)['orders'][0]
        self.assertEqual(r['production_status'],'estimated')
        self.assertEqual(r['revenue_status'],'estimated')

    def test_missing_discount_blocks_income_and_profits(self):
        d=fixture();d['orders'][0]['discount']=None
        r=calculate(d)['orders'][0]
        self.assertIsNone(r['revenue']);self.assertIsNone(r['production_profit'])

    def test_multiple_order_lines_sum_once(self):
        d=fixture();d['order_lines']=[{'order_id':'A','line_id':'1','quantity':'400','unit':'双','unit_price':'20','discount':'80'},
            {'order_id':'A','line_id':'2','quantity':'600','unit':'双','unit_price':'30','discount':'120'}]
        r=calculate(d)['orders'][0]
        self.assertEqual(r['revenue'],'25800.00')
        self.assertEqual(len(r['line_revenues']),2)

    def test_order_lines_inconsistent_unit_rejected(self):
        d=fixture();d['order_lines']=[{'order_id':'A','line_id':'1','quantity':'1000','unit':'kg','unit_price':'20','discount':'0'}]
        with self.assertRaises(ValueError):calculate(d)


if __name__ == '__main__': unittest.main()

"""Conservative per-order input matching, independent of filenames and saved profits."""
import hashlib
import json
from decimal import Decimal,InvalidOperation
from .history import SNAPSHOT_ID,load_snapshot,is_deleted

NUMERIC={'quantity','unit_price','discount','rate','loss_rate','amount','total_base','base','unit_rate','weight','weight_total','price_per_kg','amount_exact','produced','defects','qualified','replenishment','difference','gross_quantity','defect_quantity','qualified_quantity','replenishment_quantity','expected','actual','price','ratio','value','sop_weight'}
PROVENANCE={'source','source_cell','source_sheet','cell','formula','raw','source_hash','import_review','formula_traces'}
SOURCE_KEYS=('materials','cost_rows','production','remaining_checks')


def normalized(value,key=''):
    if isinstance(value,dict):return {k:normalized(v,k) for k,v in sorted(value.items()) if k not in PROVENANCE}
    if isinstance(value,list):return sorted([normalized(x,key) for x in value],key=lambda x:json.dumps(x,ensure_ascii=False,sort_keys=True))
    if not isinstance(value,bool) and value is not None and (key in NUMERIC or isinstance(value,(int,float,Decimal))):
        try:
            d=Decimal(str(value))
            if d.is_finite():
                # Avoid context rounding even for high precision costs.
                text=format(d,'f');return (text.rstrip('0').rstrip('.') if '.' in text else text) if d else '0'
        except InvalidOperation:pass
    return value


def digest(value):
    return hashlib.sha256(json.dumps(normalized(value),sort_keys=True,ensure_ascii=False,allow_nan=False,separators=(',',':')).encode()).hexdigest()


def input_fingerprints(data):
    meta={k:v for k,v in data['metadata'].items() if k not in ('source_hash','import_review','formula_source')}
    fingerprints={}
    for order in data['orders']:
        oid=order['order_id'];item={'metadata':meta,'orders':[order]}
        for table in ('order_lines','materials','labor','costs','bases','coverage'):
            item[table]=[r for r in data.get(table,[]) if r.get('order_id')==oid]
        pools={r['pool_id'] for r in item['bases']}
        item['pools']=[r for r in data.get('pools',[]) if r.get('pool_id') in pools]
        source=data.get('source_analysis') or {}
        if source.get('order_id')==oid:item['source_inputs']={k:source.get(k) for k in SOURCE_KEYS}
        fingerprints[oid]=digest(item)
    return fingerprints


def legacy_source_fingerprint(result,oid):
    source=result.get('source_analysis') or {}
    if source.get('order_id')!=oid:return None
    return digest({'order':next(x for x in result['orders'] if x['order_id']==oid),
                   'order_inputs':{k:(source.get('metrics') or {}).get(k) for k in ('quantity','list_unit_price','discount_per_pair')},
                   'source_inputs':{k:source.get(k) for k in SOURCE_KEYS}})


def order_result_fingerprint(result,oid):
    return digest({'orders':[x for x in result['orders'] if x['order_id']==oid],
                   'costs':[x for x in result['costs'] if x.get('order_id')==oid],
                   'allocations':[{k:x.get(k) for k in ('pool_id','period','amount','rounding_adjustment')} for x in result['allocations'] if x.get('order_id')==oid]})


def find_duplicates(storage,result,fingerprints,source_hash=None):
    found={};candidates=[]
    for path in storage.glob('*.json'):
        if not SNAPSHOT_ID.fullmatch(path.stem):continue
        try:old=load_snapshot(storage,path.stem)
        except ValueError:continue
        if old['snapshot'].get('formula_version')!=result['snapshot']['formula_version']:continue
        candidates.append(old)
    candidates.sort(key=lambda x:(x['snapshot'].get('created_at',''),x['snapshot']['snapshot_id']),reverse=True)
    for old in candidates:
        snap=old['snapshot'];identity=snap.get('import_identity') or {}
        old_hashes=identity.get('order_hashes') or {}
        old_source=identity.get('source_hash') or (old.get('source_analysis') or {}).get('source_hash') or (snap.get('import_review') or {}).get('source_hash')
        for order in old['orders']:
            oid=order['order_id']
            if oid not in fingerprints:continue
            matches=old_hashes.get(oid)==fingerprints[oid]
            if oid not in old_hashes:
                previous=legacy_source_fingerprint(old,oid)
                if previous is not None:
                    matches=previous==legacy_source_fingerprint(result,oid)
                else:
                    matches=bool(source_hash and old_source==source_hash) or snap.get('input_hash')==result['snapshot'].get('input_hash')
            if not matches or order_result_fingerprint(old,oid)!=order_result_fingerprint(result,oid):continue
            deleted=is_deleted(storage,snap['snapshot_id'],oid)
            if oid in found and (not found[oid]['deleted'] or deleted):continue
            found[oid]={'snapshot_id':snap['snapshot_id'],'order_id':oid,'product':order.get('product',''),
                        'created_at':snap.get('created_at',''),'deleted':deleted}
    grouped={}
    for row in found.values():
        group=grouped.setdefault(row['snapshot_id'],{'snapshot_id':row['snapshot_id'],'created_at':row['created_at'],'orders':[]})
        group['orders'].append({k:v for k,v in row.items() if k not in ('snapshot_id','created_at')})
    return list(grouped.values())

"""Order history with reversible per-order deletion; snapshots remain unchanged."""
import json
import hashlib
import threading
from datetime import datetime,timezone
from uuid import uuid4
import re
from pathlib import Path
from .ollama_client import validate_result

SNAPSHOT_ID=re.compile(r'[A-Za-z0-9-]{10,80}')

TRASH_LOCK=threading.RLock()


def deletion_path(storage,sid,oid):
    if not isinstance(sid,str) or not SNAPSHOT_ID.fullmatch(sid):raise ValueError('无效历史版本编号')
    if not isinstance(oid,str) or not oid or len(oid)>200:raise ValueError('请选择有效历史订单')
    root=Path(storage).resolve();folder=root/'history-trash'
    if folder.is_symlink() or folder.resolve().parent!=root:raise ValueError('回收站路径无效')
    return folder/(sid+'-'+hashlib.sha256(oid.encode()).hexdigest()+'.json')


def is_deleted(storage,sid,oid):
    return deletion_path(storage,sid,oid).exists()


def set_deleted(storage,sid,oid,deleted):
    with TRASH_LOCK:
        data=load_snapshot(storage,sid)
        if not any(x['order_id']==oid for x in data['orders']):raise ValueError('所选订单不属于该历史版本')
        target=deletion_path(storage,sid,oid)
        if target.is_symlink():raise ValueError('回收站文件不可操作')
        if deleted and not target.exists():
            target.parent.mkdir(parents=True,exist_ok=True)
            temp=target.with_suffix('.'+uuid4().hex+'.tmp')
            temp.write_text(json.dumps({'snapshot_id':sid,'order_id':oid,'deleted_at':datetime.now(timezone.utc).isoformat()},ensure_ascii=False),encoding='utf-8')
            temp.replace(target)
        elif not deleted:target.unlink(missing_ok=True)
    return {'status':'deleted' if deleted else 'restored','snapshot_id':sid,'order_id':oid}


def visible_snapshot(storage,data):
    sid=data['snapshot']['snapshot_id']
    allowed={x['order_id'] for x in data['orders'] if not is_deleted(storage,sid,x['order_id'])}
    if not allowed:return None
    for table in ('orders','costs','allocations','issues'):
        data[table]=[x for x in data[table] if x.get('order_id') in allowed]
    if (data.get('source_analysis') or {}).get('order_id') not in allowed:data.pop('source_analysis',None)
    return data


def load_snapshot(storage,sid):
    if not isinstance(sid,str) or not SNAPSHOT_ID.fullmatch(sid):
        raise ValueError('无效历史版本编号')
    storage=Path(storage).resolve()
    path=storage/(sid+'.json')
    if path.is_symlink() or path.resolve().parent!=storage or not path.is_file():
        raise ValueError('历史版本不存在或不可读取')
    try:
        data=json.loads(path.read_text(encoding='utf-8'))
        if not isinstance(data,dict) or not isinstance(data.get('snapshot'),dict):raise ValueError()
        if data['snapshot'].get('snapshot_id')!=sid:raise ValueError()
        if not isinstance(data['snapshot'].get('created_at',''),str):raise ValueError()
        source=data.get('source_analysis')
        if source is not None:
            if not isinstance(source,dict):raise ValueError()
            if 'metrics' in source and not isinstance(source['metrics'],dict):raise ValueError()
        for table in ('orders','costs','allocations','issues'):
            if not isinstance(data.get(table),list) or any(not isinstance(x,dict) for x in data[table]):raise ValueError()
        if any(not isinstance(x.get('order_id'),str) or not x['order_id'] for x in data['orders']):raise ValueError()
        return data
    except (OSError,ValueError,TypeError):
        raise ValueError('历史版本文件损坏或格式不兼容') from None


def list_history(storage,deleted=False):
    groups={};skipped=0
    for path in Path(storage).glob('*.json'):
        if not SNAPSHOT_ID.fullmatch(path.stem):continue
        try:data=load_snapshot(storage,path.stem)
        except ValueError:skipped+=1;continue
        snap=data['snapshot'];source=data.get('source_analysis') or {}
        for order in data['orders']:
            oid=order['order_id']
            if is_deleted(storage,snap['snapshot_id'],oid)!=deleted:continue
            group=groups.setdefault(oid,{'order_id':oid,'versions':[]})
            trial=source.get('metrics') if source.get('order_id')==oid else None
            group['versions'].append({
                'snapshot_id':snap['snapshot_id'],'created_at':snap.get('created_at',''),
                'cutoff_date':snap.get('cutoff_date',''),'is_demo':snap.get('is_demo',False),
                'formula_version':snap.get('formula_version',''),'product':order.get('product',''),
                'customer':order.get('customer',''),'quantity':order.get('quantity'),'unit':order.get('unit',''),
                'revenue':trial.get('revenue',order.get('revenue')) if trial else order.get('revenue'),
                'production_profit':trial.get('production_profit') if trial else order.get('production_profit'),
                'management_profit':trial.get('management_reference_profit') if trial else order.get('management_profit'),
                'profit_basis':'trial' if trial else 'standard',
                'production_status':order.get('production_status'),'management_status':order.get('management_status')})
    for group in groups.values():
        group['versions'].sort(key=lambda x:(x['created_at'],x['snapshot_id']),reverse=True)
    orders=sorted(groups.values(),key=lambda x:x['versions'][0]['created_at'],reverse=True)
    return {'orders':orders,'skipped_files':skipped}


def read_history(storage,sid,order_id):
    if not isinstance(order_id,str) or not order_id or len(order_id)>200:
        raise ValueError('请选择要查看的历史订单')
    data=load_snapshot(storage,sid)
    if is_deleted(storage,sid,order_id):raise ValueError('该分析记录已在回收站，请先恢复')
    if not any(x['order_id']==order_id for x in data['orders']):
        raise ValueError('所选订单不属于该历史版本')
    for table in ('orders','costs','allocations','issues'):
        data[table]=[x for x in data[table] if x.get('order_id')==order_id]
    if (data.get('source_analysis') or {}).get('order_id')!=order_id:data.pop('source_analysis',None)
    records=[]
    for path in (Path(storage)/'ai-analyses').glob('*.json'):
        if path.is_symlink():continue
        try:
            record=json.loads(path.read_text(encoding='utf-8'))
            req=record.get('request',{});context=record.get('context',{})
            if req.get('snapshot_id')!=sid or req.get('order_id')!=order_id:continue
            if context.get('order',{}).get('order_id')!=order_id or context.get('snapshot',{}).get('snapshot_id')!=sid:continue
            if record.get('status')!='completed' or not isinstance(record.get('result'),dict):continue
            evidence=record.get('evidence')
            if not isinstance(evidence,list) or any(not isinstance(x,dict) or not isinstance(x.get('id'),str) for x in evidence):continue
            validate_result(record['result'],{'facts':evidence})
            records.append(record)
        except (OSError,ValueError,TypeError,AttributeError,KeyError):continue
    records.sort(key=lambda x:str(x.get('created_at','')),reverse=True)
    data['analysis_records']=records
    return data

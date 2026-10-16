import unittest
from unittest.mock import Mock
import json
from profit_model.ollama_client import OllamaClient,validate_result,model_context


class OllamaTests(unittest.TestCase):
    def test_saved_profit_answers_never_enter_model_context(self):
        source={'metrics':{'production_profit':'100.00'},'trust_review':{'checks':[
            {'code':'COMPARE_H24','status':'passed','title':'profit comparison','evidence':'saved answer 999999.00'},
            {'code':'COMPARE_H33','status':'passed','title':'net comparison','evidence':'saved answer 888888.00'},
            {'code':'REPLENISHMENT','status':'difference','title':'quantity gap','evidence':'gap 2 pairs'}]}}
        context={'order':{'order_id':'TEST','product':'Synthetic','quantity':'10','unit':'双','mode':'forecast'},'costs':[],'source_analysis':source}
        prepared=model_context(context)
        serialized=json.dumps(prepared)
        self.assertNotIn('999999',serialized)
        self.assertNotIn('888888',serialized)
        self.assertNotIn('COMPARE_',serialized)
        self.assertIn('metric:production_profit',serialized)
        self.assertIn('review:REPLENISHMENT',serialized)

    def test_generation_constrains_references_to_current_order_facts(self):
        client=OllamaClient('test-local')
        answer={'summary':'待核验','risks':[],'recommendations':[{'action':'复核','reason':'存在收入','conditions':'确认口径','evidence_ids':['metric:revenue']}],'unknowns':[]}
        client._request=Mock(return_value={'message':{'content':json.dumps(answer)},'done_reason':'stop'})
        result=client.generate({'facts':[{'id':'metric:revenue','value':'100.00'}]},{'focus':'decision','question':''})
        self.assertEqual(result['result'],answer)
        payload=client._request.call_args.args[1]
        self.assertEqual(payload['format']['properties']['risks']['items']['properties']['evidence_ids']['items']['enum'],['metric:revenue'])
        self.assertFalse(payload['think'])
        answer['recommendations'][0]['evidence_ids']=['metric:made-up']
        with self.assertRaises(ValueError):validate_result(answer,{'facts':[{'id':'metric:revenue'}]})

    def test_cloud_models_cannot_be_used_as_local_provider(self):
        client=OllamaClient('qwen-cloud')
        client._request=Mock(return_value={'models':[{'name':'qwen-cloud','remote_host':'https://example.com'}]})
        self.assertFalse(client.status()['configured'])

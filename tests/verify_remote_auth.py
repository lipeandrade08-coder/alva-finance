"""Integração real. Credenciais sintéticas só em memória, limpeza em finally."""
import json, subprocess, urllib.request, urllib.error, uuid, copy, secrets
ref='hulthncrbuyqedvdkynv';base='https://'+ref+'.supabase.co'
keys=json.loads(subprocess.run(['supabase','projects','api-keys','--project-ref',ref,'--output','json'],capture_output=True,text=True,check=True).stdout)
public=next(k['api_key'] for k in keys if k.get('name')=='anon')
service=next(k['api_key'] for k in keys if k.get('name')=='service_role')
created=[];results={}
def request(path,body=None,token=None,admin=False,method=None,allow_error=False):
 key=service if admin else public;headers={'apikey':key,'Content-Type':'application/json'}
 if admin or token:headers['Authorization']='Bearer '+(service if admin else token)
 req=urllib.request.Request(base+path,data=json.dumps(body).encode() if body is not None else None,headers=headers,method=method or ('POST' if body is not None else 'GET'))
 try:
  with urllib.request.urlopen(req,timeout=30) as response:
   raw=response.read();return response.status,json.loads(raw) if raw else None
 except urllib.error.HTTPError as err:
  if allow_error:
   try:detail=json.loads(err.read())
   except:detail={}
   return err.code,{'code':detail.get('error_code') or detail.get('code')}
  raise RuntimeError('remote operation failed, HTTP '+str(err.code)+' at '+path.split('?')[0]) from None
try:
 sessions=[]
 for label in ['a','b']:
  email='alva-qa-'+label+'-'+uuid.uuid4().hex[:12]+'@example.com';password='Aa1!'+secrets.token_urlsafe(26)
  _,signed=request('/auth/v1/signup',{'email':email,'password':password,'data':{'full_name':'Alva QA '+label}})
  user_id=signed.get('user',{}).get('id')
  if user_id:created.append(user_id)
  assert user_id and signed.get('access_token') and signed.get('refresh_token')
  token=signed['access_token'];assert signed['expires_in']==900
  status,_=request('/auth/v1/token?grant_type=password',{'email':email,'password':password+'wrong'},allow_error=True);assert status>=400
  _,login=request('/auth/v1/token?grant_type=password',{'email':email,'password':password});assert login['user']['id']==user_id
  # A sessão usada abaixo é a do cadastro. A sessão extra é revogada agora.
  request('/auth/v1/logout?scope=local',token=login['access_token'],method='POST')
  request('/rest/v1/rpc/ensure_alva_account',{},token);request('/rest/v1/rpc/ensure_alva_account',{},token)
  _,rows=request('/rest/v1/finance_data?select=user_id,data,revision',token=token)
  assert len(rows)==1 and rows[0]['user_id']==user_id and rows[0]['data']['transactions']==[]
  sessions.append((user_id,token,rows[0],signed['refresh_token']))
 results.update(signup_without_email_confirmation=True,password_login_and_wrong_password_rejection=True,empty_accounts_created=True,short_lived_access_tokens=True)
 a,atoken,arow,arefresh=sessions[0];b,btoken,brow,brefresh=sessions[1]
 _,foreign=request('/rest/v1/finance_data?user_id=eq.'+a+'&select=*',token=btoken);assert foreign==[]
 _,profiles=request('/rest/v1/profiles?select=id',token=btoken);assert profiles==[{'id':b}]
 for method in ['PATCH','DELETE']:
  status,_=request('/rest/v1/finance_data?user_id=eq.'+a,{'data':{}} if method=='PATCH' else None,token=btoken,method=method,allow_error=True);assert status>=400
 status,_=request('/rest/v1/finance_data?select=user_id',allow_error=True);assert status>=400
 status,_=request('/rest/v1/rpc/save_finances',{'new_data':{},'expected_revision':0},allow_error=True);assert status>=400
 results.update(cross_account_reads_denied=True,direct_updates_deletes_and_anonymous_access_denied=True)
 new=copy.deepcopy(arow['data']);new['profile']['name']='Alva QA A'
 new['transactions']=[{'id':str(uuid.uuid4()),'name':'<img src=x onerror=alert(1)>','amount':12345,'type':'expense','category':'Outros','date':'2026-11-05'}]
 _,revision=request('/rest/v1/rpc/save_finances',{'new_data':new,'expected_revision':0},atoken);assert revision==1
 _,unchanged=request('/rest/v1/finance_data?select=data,revision',token=btoken);assert unchanged[0]['revision']==0
 status,_=request('/rest/v1/rpc/save_finances',{'new_data':new,'expected_revision':0},atoken,allow_error=True);assert status>=400
 bad=copy.deepcopy(new);bad['transactions'][0]['id']='" onmouseover="alert(1)'
 status,_=request('/rest/v1/rpc/save_finances',{'new_data':bad,'expected_revision':1},atoken,allow_error=True);assert status>=400
 bad=copy.deepcopy(new);bad['transactions'][0]['amount']=1.5
 status,_=request('/rest/v1/rpc/save_finances',{'new_data':bad,'expected_revision':1},atoken,allow_error=True);assert status>=400
 request('/rest/v1/rpc/ensure_alva_account',{},atoken)
 _,rows=request('/rest/v1/finance_data?select=data,revision',token=atoken);assert rows[0]['revision']==1
 results.update(valid_save_isolated=True,revision_conflicts_rejected=True,unsafe_ids_and_fractional_cents_rejected=True,provisioning_preserves_data=True)
 request('/auth/v1/logout?scope=local',token=atoken,method='POST')
 for path,body in [('/rest/v1/finance_data?select=user_id',None),('/rest/v1/rpc/save_finances',{'new_data':new,'expected_revision':1}),('/rest/v1/rpc/ensure_alva_account',{})]:
  status,_=request(path,body,atoken,allow_error=True);assert status>=400
 status,_=request('/auth/v1/token?grant_type=refresh_token',{'refresh_token':arefresh},allow_error=True);assert status>=400
 results.update(revoked_session_cannot_read_or_write=True,revoked_refresh_token_rejected=True)
 # Política de senha também deve existir no servidor, sem depender do formulário.
 email='alva-qa-weak-'+uuid.uuid4().hex[:12]+'@example.com'
 status,weak=request('/auth/v1/signup',{'email':email,'password':'weak','data':{}},allow_error=True);assert status>=400 and weak.get('code')=='weak_password'
 results['server_password_policy_enforced']=True
finally:
 cleanup=True
 for user_id in created:
  status,_=request('/auth/v1/admin/users/'+user_id,admin=True,method='DELETE',allow_error=True);cleanup=cleanup and status<400
 results['temporary_accounts_removed']=cleanup
 print(json.dumps(results))

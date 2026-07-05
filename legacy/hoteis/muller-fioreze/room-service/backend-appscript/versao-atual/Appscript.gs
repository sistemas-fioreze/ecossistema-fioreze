// ==========================================
// MOTOR V8 - ROOM SERVICE MULLER (v7.2)
// ==========================================
const SPREAD_SISTEMA = "GOOGLE_SHEET_ID_REMOVIDO";
const SPREAD_CARDAPIO = "GOOGLE_SHEET_ID_REMOVIDO";

const USER_DEFAULT_HEADERS = ["Código","Nome","Senha","Nível","Tema","Status","Trocar Senha","Notificações","Escala da interface","Permissões do usuario","Mostrou changelog","Log"];
const DEFAULT_NORMAL_PERMISSIONS = ["dashboard","vendas","hist","hospedes"];

function jsonOut(obj){return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);}
function ssSistema(){return SpreadsheetApp.openById(SPREAD_SISTEMA);}
function ssCardapio(){return SpreadsheetApp.openById(SPREAD_CARDAPIO);}
function normalizeKey(v){return String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]/g,"");}
function getSheetOrCreate(ss,name,headers){
  let sh=ss.getSheetByName(name);
  if(!sh){sh=ss.insertSheet(name); if(headers)sh.appendRow(headers);}
  return sh;
}
function getHeaderMap(sheet){
  const last=Math.max(sheet.getLastColumn(),1);
  const headers=sheet.getRange(1,1,1,last).getDisplayValues()[0];
  const map={};
  headers.forEach((h,i)=>{map[normalizeKey(h)]=i+1;});
  return map;
}
function col(map,names,fallback){
  for(const n of names){const k=normalizeKey(n); if(map[k])return map[k];}
  return fallback;
}
function userCols(sheet){
  const map=getHeaderMap(sheet);
  return {
    codigo: col(map,["Código","Codigo"],1),
    nome: col(map,["Nome"],2),
    senha: col(map,["Senha"],3),
    nivel: col(map,["Nível","Nivel"],4),
    tema: col(map,["Tema"],5),
    status: col(map,["Status"],6),
    trocarSenha: col(map,["Trocar Senha","Troca Senha","Solicitar Troca Senha","Solicitar troca de senha"],7),
    notificacoes: col(map,["Notificações","Notificacoes"],8),
    escala: col(map,["Escala da interface","Escala interface","Escala"],9),
    permissoes: col(map,["Permissões do usuario","Permissoes do usuario","Permissões","Permissoes"],10),
    mostrou: col(map,["Mostrou changelog","Mostrou novidades"],11),
    log: col(map,["Log"],12)
  };
}
function ensureUserColumns(sheet){
  const last=Math.max(sheet.getLastColumn(),1);
  const headers=sheet.getRange(1,1,1,last).getDisplayValues()[0];
  const existing={};
  headers.forEach(h=>{if(h)existing[normalizeKey(h)]=true;});
  USER_DEFAULT_HEADERS.forEach(h=>{
    const k=normalizeKey(h);
    if(!existing[k]){
      sheet.getRange(1,sheet.getLastColumn()+1).setValue(h);
      existing[k]=true;
    }
  });
}
function parseJSONCell(v,fallback){
  try{const parsed=JSON.parse(String(v||"")); return parsed || fallback;}catch(e){return fallback;}
}
function userObject(row,idx,c){
  const permissions = row[c.permissoes-1] || "";
  const escala = parseInt(row[c.escala-1],10) || 100;
  return {
    linha: idx+1,
    codigo: row[c.codigo-1],
    nome: row[c.nome-1],
    nivel: String(row[c.nivel-1]||"Normal").trim(),
    tema: row[c.tema-1] || "Claro",
    status: row[c.status-1] || "Offline",
    trocarSenha: row[c.trocarSenha-1] || "N",
    solicitarTrocaSenha: String(row[c.trocarSenha-1]||"").trim().toUpperCase()==="S",
    forcePasswordChange: String(row[c.trocarSenha-1]||"").trim().toUpperCase()==="S",
    notificacoes: row[c.notificacoes-1] || "[]",
    escalaInterface: escala,
    permissoesRaw: permissions,
    permissoes: parseJSONCell(permissions, String(permissions||"").split(/[;,|]/).map(x=>x.trim()).filter(Boolean)),
    mostrouChangelog: row[c.mostrou-1] || "N",
    log: row[c.log-1] || "[]"
  };
}
function appendUserLog(codigo,tipo,detalhe){
  const sh=getSheetOrCreate(ssSistema(),"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh);
  const c=userCols(sh); const data=sh.getDataRange().getValues();
  const now=new Date();
  const entry={
    data:Utilities.formatDate(now,"GMT-3","dd/MM/yyyy HH:mm:ss"),
    dataISO:Utilities.formatDate(now,"GMT-3","yyyy-MM-dd'T'HH:mm:ss"),
    tipo:String(tipo||"acao"),
    detalhe:String(detalhe||""),
    codigo:String(codigo||""),
    usuario:"",
    nivel:"",
    status:"",
    origem:"ERP"
  };
  for(let i=1;i<data.length;i++){
    if(String(data[i][c.codigo-1]).trim()===String(codigo).trim()){
      entry.usuario=String(data[i][c.nome-1]||"");
      entry.nivel=String(data[i][c.nivel-1]||"");
      entry.status=String(data[i][c.status-1]||"");
      let logs=parseJSONCell(data[i][c.log-1],[]);
      logs.unshift(entry); logs=logs.slice(0,300);
      sh.getRange(i+1,c.log).setValue(JSON.stringify(logs));
      break;
    }
  }
}

function hashPassword(value){
  const raw=String(value||"");
  const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
  return "HASH:"+bytes.map(function(b){return ("0"+((b+256)%256).toString(16)).slice(-2);}).join("");
}
function isPasswordValid(stored, provided){
  const s=String(stored||"").trim();
  const p=String(provided||"").trim();
  if(s==="0")return p.length>0;
  if(s.indexOf("HASH:")===0)return s===hashPassword(p);
  return s===p;
}


function parseClockMinutes(value, fallback){
  const s=String(value||fallback||"").trim();
  const m=s.match(/^(\d{1,2}):(\d{2})/);
  if(!m)return parseClockMinutes(fallback||"16:00","16:00");
  return Math.max(0,Math.min(1439,(parseInt(m[1],10)||0)*60+(parseInt(m[2],10)||0)));
}
function formatClockValue(value, fallback){
  const min=parseClockMinutes(value,fallback);
  return ("0"+Math.floor(min/60)).slice(-2)+":"+("0"+(min%60)).slice(-2);
}
function isNowInsideWindow(start,end){
  const now=new Date();
  const hour=parseInt(Utilities.formatDate(now,"GMT-3","H"),10)||0;
  const minute=parseInt(Utilities.formatDate(now,"GMT-3","m"),10)||0;
  const cur=hour*60+minute;
  const s=parseClockMinutes(start,"16:00");
  const e=parseClockMinutes(end,"22:00");
  if(s===e)return true;
  return s<e ? cur>=s && cur<e : (cur>=s || cur<e);
}
function storeParamCols(sheet){
  const map=getHeaderMap(sheet);
  return {
    manual: col(map,["Abertura Manual"],1),
    status: col(map,["Status"],2),
    autoStart: col(map,["Hora Abertura Auto","Abertura"],3),
    autoEnd: col(map,["Hora Fechamento Auto","Fechamento"],4)
  };
}
function readStoreTime(sheet,column,fallback){
  const cell=sheet.getRange(2,column);
  return cell.getDisplayValue() || cell.getValue() || fallback;
}
function getStoreParams(){
  const ss=ssSistema();
  const sh=getSheetOrCreate(ss,"Parametros",["Abertura Manual","Status","Abertura","Fechamento"]);
  const c=storeParamCols(sh);
  const manual=String(sh.getRange(2,c.manual).getValue()||"Não");
  const rawStatus=String(sh.getRange(2,c.status).getValue()||"Fechado");
  const autoStart=formatClockValue(readStoreTime(sh,c.autoStart,"16:00"),"16:00");
  const autoEnd=formatClockValue(readStoreTime(sh,c.autoEnd,"22:00"),"22:00");
  const status=String(manual).trim().toLowerCase()==="sim" ? rawStatus : (isNowInsideWindow(autoStart,autoEnd)?"Aberto":"Fechado");
  return {manual,status,autoStart,autoEnd,open:String(status).trim().toLowerCase()==="aberto"};
}

function requireMaster(nivel){if(String(nivel||"").trim().toLowerCase()!=="master")throw new Error("Sem permissão");}

function doPost(e){
  try{
    const p=JSON.parse(e.postData.contents||"{}");
    const action=p.action;
    const ss=ssSistema();

    if(action==="login"){
      const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh);
      const c=userCols(sh); const data=sh.getDataRange().getValues();
      for(let i=1;i<data.length;i++){
        if(String(data[i][c.codigo-1]).trim()===String(p.codigo).trim() && isPasswordValid(data[i][c.senha-1], p.senha)){
          const stored=String(data[i][c.senha-1]||"").trim();
          sh.getRange(i+1,c.status).setValue("Online");
          if(stored && stored!=="0" && stored.indexOf("HASH:")!==0)sh.getRange(i+1,c.senha).setValue(hashPassword(p.senha));
          appendUserLog(data[i][c.codigo-1],"login","Entrou no sistema pelo ERP");
          const refreshed=sh.getRange(i+1,1,1,Math.max(sh.getLastColumn(),USER_DEFAULT_HEADERS.length)).getValues()[0];
          const u=userObject(refreshed,i+1,c);
          if(stored==="0"||String(data[i][c.trocarSenha-1]||"").trim().toUpperCase()==="S")u.forcePasswordChange=true;
          return jsonOut({success:true,user:u,forcePasswordChange:!!u.forcePasswordChange});
        }
      }
      return jsonOut({success:false});
    }

    if(action==="logout"){
      const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh);
      const c=userCols(sh); const data=sh.getDataRange().getValues();
      for(let i=1;i<data.length;i++){if(String(data[i][c.codigo-1]).trim()===String(p.codigo).trim()){sh.getRange(i+1,c.status).setValue("Offline"); appendUserLog(p.codigo,"logout","Saiu do sistema e encerrou a sessão"); break;}}
      return jsonOut({success:true});
    }

    if(action==="log_user_action"){appendUserLog(p.codigo,p.tipo,p.detalhe); return jsonOut({success:true});}
    if(action==="mark_changelog_seen"){
      const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh);
      const c=userCols(sh); const data=sh.getDataRange().getValues();
      for(let i=1;i<data.length;i++){if(String(data[i][c.codigo-1]).trim()===String(p.codigo).trim()){sh.getRange(i+1,c.mostrou).setValue("S"); break;}}
      return jsonOut({success:true});
    }
    if(action==="save_user_preferences"){
      const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh);
      const c=userCols(sh); const data=sh.getDataRange().getValues();
      for(let i=1;i<data.length;i++){if(String(data[i][c.codigo-1]).trim()===String(p.codigo).trim()){if(p.escalaInterface)sh.getRange(i+1,c.escala).setValue(parseInt(p.escalaInterface,10)||100); appendUserLog(p.codigo,"preferencias","Atualizou preferências da interface para escala "+(parseInt(p.escalaInterface,10)||100)+"%"); break;}}
      return jsonOut({success:true});
    }
    if(action==="save_user_permissions"){
      requireMaster(p.nivelLogado);
      const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh);
      const c=userCols(sh); const data=sh.getDataRange().getValues();
      for(let i=1;i<data.length;i++){
        if(String(data[i][c.codigo-1]).trim()===String(p.codigoAlvo).trim()){
          sh.getRange(i+1,c.permissoes).setValue(JSON.stringify(p.permissoes||DEFAULT_NORMAL_PERMISSIONS));
          appendUserLog(p.codigoAlvo,"permissoes","Permissões alteradas por administrador");
          if(p.codigoAdmin)appendUserLog(p.codigoAdmin,"permissoes","Alterou permissões de "+(data[i][c.nome-1]||p.codigoAlvo));
          break;
        }
      }
      return jsonOut({success:true});
    }

    if(action==="save_user"){
      requireMaster(p.nivelLogado);
      const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh);
      const c=userCols(sh); const data=sh.getDataRange().getValues();
      for(let i=1;i<data.length;i++){if(String(data[i][c.codigo-1]).trim()===String(p.novoCodigo).trim())throw new Error("Código já existente");}
      const row=[]; row[c.codigo-1]=p.novoCodigo; row[c.nome-1]=p.novoNome; row[c.senha-1]=hashPassword(p.novaSenha); row[c.nivel-1]=p.novoNivel; row[c.tema-1]="Claro"; row[c.status-1]="Offline"; row[c.trocarSenha-1]="N"; row[c.notificacoes-1]="[]"; row[c.escala-1]=100; row[c.permissoes-1]=JSON.stringify(DEFAULT_NORMAL_PERMISSIONS); row[c.mostrou-1]="N"; row[c.log-1]="[]";
      sh.appendRow(row);
      appendUserLog(p.novoCodigo,"usuario","Usuário criado");
      return jsonOut({success:true});
    }
    if(action==="delete_user"){
      requireMaster(p.nivelLogado);
      const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); const c=userCols(sh); const data=sh.getDataRange().getValues();
      for(let i=1;i<data.length;i++){if(String(data[i][c.codigo-1])===String(p.codigoParaApagar)){sh.deleteRow(i+1); break;}}
      return jsonOut({success:true});
    }
    if(action==="request_password_change"){
      requireMaster(p.nivelLogado);
      const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh);
      const c=userCols(sh); const data=sh.getDataRange().getValues();
      for(let i=1;i<data.length;i++){
        if(String(data[i][c.codigo-1]).trim()===String(p.codigoAlvo).trim()){
          sh.getRange(i+1,c.trocarSenha).setValue("S");
          break;
        }
      }
      appendUserLog(p.codigoAlvo,"senha","Administrador solicitou troca de senha no próximo login");
      if(p.codigoAdmin)appendUserLog(p.codigoAdmin,"senha","Solicitou troca de senha para "+(p.nomeAlvo||p.codigoAlvo));
      return jsonOut({success:true});
    }
    if(action==="change_own_password"){
      const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); const c=userCols(sh); const data=sh.getDataRange().getValues();
      for(let i=1;i<data.length;i++){if(String(data[i][c.codigo-1])===String(p.codigo)){sh.getRange(i+1,c.senha).setValue(hashPassword(p.novaSenha)); sh.getRange(i+1,c.trocarSenha).setValue("N"); appendUserLog(p.codigo,"senha","Alterou a própria senha"); break;}}
      return jsonOut({success:true});
    }

    if(action==="send_chat"){
      getSheetOrCreate(ss,"Chat",["Data","Quarto","Remetente","Mensagem","Atendente"]).appendRow([new Date(),String(p.quarto),p.remetente,p.mensagem,p.atendente||""]);
      return jsonOut({success:true});
    }
    if(action==="end_chat"){
      const sh=getSheetOrCreate(ss,"Chat",["Data","Quarto","Remetente","Mensagem","Atendente"]); const data=sh.getDataRange().getValues();
      for(let i=data.length-1;i>=1;i--){if(String(data[i][1]).trim()===String(p.quarto).trim())sh.deleteRow(i+1);}
      return jsonOut({success:true});
    }
    if(action==="sync_hospede"){
      const sh=getSheetOrCreate(ss,"Hospedes",["Data","Nome","Celular","Apto"]); const data=sh.getDataRange().getValues(); let found=false;
      for(let i=1;i<data.length;i++){if(String(data[i][3])===String(p.apto)){sh.getRange(i+1,1,1,4).setValues([[new Date(),p.nome,p.celular||data[i][2],p.apto]]); found=true; break;}}
      if(!found)sh.appendRow([new Date(),p.nome,p.celular,p.apto]);
      return jsonOut({success:true});
    }
    if(action==="delete_guest"){requireMaster(p.nivelLogado); const sh=getSheetOrCreate(ss,"Hospedes",["Data","Nome","Celular","Apto"]); const data=sh.getDataRange().getValues(); for(let i=1;i<data.length;i++){if(String(data[i][3]).trim()===String(p.apto).trim()){sh.deleteRow(i+1);break;}} return jsonOut({success:true});}

    if(action==="add_order"){
      const params=getStoreParams();
      if(!params.open)return jsonOut({success:false,error:"Room Service fechado",params});
      getSheetOrCreate(ss,"Pedidos",["Data/Hora","Hóspede","Quarto","Pedido","Total","Status Impressao","Local de Consumo","Atendente","Status pedido","Observação"]).appendRow([new Date(),p.guestName||"",p.roomNumber,p.items,p.total,"Entregue",p.consumptionLocation,p.atendente,"Entregue",p.observacao||""]);
      appendUserLogByName(p.atendente,"pedido",`Lançou pedido do apto ${p.roomNumber} - R$ ${Number(p.total||0).toFixed(2)}`);
      return jsonOut({success:true});
    }
    if(action==="edit_order"){
      const sh=getSheetOrCreate(ss,"Pedidos"); const row=parseInt(p.linha,10);
      if(row>1){sh.getRange(row,2,1,9).setValues([[p.guestName||"",p.roomNumber,p.items,p.total,"reimprimir",p.consumptionLocation,p.atendente||"",p.status_pedido||"Entregue",p.observacao||""]]);}
      appendUserLogByName(p.atendente,"pedido",`Editou pedido da linha ${row}`);
      return jsonOut({success:true});
    }
    if(action==="update_order_status"){const sh=getSheetOrCreate(ss,"Pedidos"); if(p.linha>1){sh.getRange(p.linha,6).setValue(p.novoStatus); sh.getRange(p.linha,9).setValue(p.novoStatus); if(p.codigo)appendUserLog(p.codigo,"pedido_status","Alterou status do pedido linha "+p.linha+" para "+p.novoStatus);} return jsonOut({success:true});}
    if(action==="reprint_order"||action==="delete_order"){const sh=getSheetOrCreate(ss,"Pedidos"); const row=parseInt(p.linha,10); if(row>1){if(action==="reprint_order")sh.getRange(row,6).setValue("reimprimir"); else{requireMaster(p.nivelLogado); sh.deleteRow(row);}} return jsonOut({success:true});}
    if(action==="clear_notif"){const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh); const c=userCols(sh); const data=sh.getDataRange().getValues(); for(let i=1;i<data.length;i++){if(String(data[i][c.codigo-1]).trim()===String(p.codigo).trim()){sh.getRange(i+1,c.notificacoes).setValue(p.clearAll?"[]":"[]"); break;}} return jsonOut({success:true});}

    if(action==="save_menu_item"){
      requireMaster(p.nivelLogado);
      const sh=getSheetOrCreate(ssCardapio(),"Cardapio",["Categoria","Nome","Meta","Descricao","Preco","Imagem","Opcoes","Estoque","Tag","Tipo","Combo"]);
      const values=[[p.categoria,p.nome,p.meta,p.desc,p.preco,p.imagem,p.opcoes,p.estoque,p.tag,p.tipo||"Item",p.combo||""]];
      if(p.linha)sh.getRange(p.linha,1,1,11).setValues(values); else sh.appendRow(values[0]);
      if(p.codigoUsuario)appendUserLog(p.codigoUsuario, "cardapio", (p.linha?"Editou":"Criou")+" item/combo: "+p.nome);
      else appendUserLogByName(p.nomeUsuario||p.atendente||"", "cardapio", (p.linha?"Editou":"Criou")+" item/combo: "+p.nome);
      return jsonOut({success:true});
    }
    if(action==="toggle_stock"){requireMaster(p.nivelLogado); ssCardapio().getSheetByName("Cardapio").getRange(p.linha,8).setValue(p.novoEstoque); return jsonOut({success:true});}
    if(action==="delete_menu_item"){requireMaster(p.nivelLogado); ssCardapio().getSheetByName("Cardapio").deleteRow(parseInt(p.linha,10)); return jsonOut({success:true});}
    if(action==="update_store_status"){
      let sh=getSheetOrCreate(ss,"Parametros",["Abertura Manual","Status","Abertura","Fechamento"]);
      const c=storeParamCols(sh);
      const autoStart=formatClockValue(p.autoStart||readStoreTime(sh,c.autoStart,"16:00"),"16:00");
      const autoEnd=formatClockValue(p.autoEnd||readStoreTime(sh,c.autoEnd,"22:00"),"22:00");
      sh.getRange(2,c.manual).setValue(p.manual);
      sh.getRange(2,c.status).setValue(p.status);
      sh.getRange(2,c.autoStart).setValue(autoStart);
      sh.getRange(2,c.autoEnd).setValue(autoEnd);
      if(p.codigo)appendUserLog(p.codigo,"funcionamento","Alterou funcionamento para "+p.status+" / "+(String(p.manual)==="Sim"?"manual":"automático")+" ("+autoStart+"-"+autoEnd+")");
      return jsonOut({success:true});
    }
    return jsonOut({success:false,error:"Ação desconhecida"});
  }catch(err){return jsonOut({success:false,error:err.message});}
}

function appendUserLogByName(nome,tipo,detalhe){
  const sh=getSheetOrCreate(ssSistema(),"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh);
  const c=userCols(sh); const data=sh.getDataRange().getValues();
  for(let i=1;i<data.length;i++){if(String(data[i][c.nome-1]).trim().toLowerCase()===String(nome||"").trim().toLowerCase()){appendUserLog(data[i][c.codigo-1],tipo,detalhe);break;}}
}

function doGet(e){
  const q=e.parameter.q;
  const ss=ssSistema();
  if(q==="site"||q==="internal"){
    const sh=ss.getSheetByName("Codigo"); const col=q==="site"?"A2:A30":"B2:B40"; const values=sh.getRange(col).getValues(); let html=""; values.forEach(r=>{if(r[0])html+=r[0];});
    return HtmlService.createHtmlOutput(html).setTitle(q==="site"?"Room Service - Fioreze Centro":"ERP Master - Fioreze Centro").setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
  if(q==="poll_login"){return jsonOut({ordersCount:getSheetOrCreate(ss,"Pedidos").getLastRow()});}
  if(q==="poll_guest"){
    const apto=e.parameter.quarto; const chats=getSheetOrCreate(ss,"Chat",["Data","Quarto","Remetente","Mensagem","Atendente"]).getDataRange().getDisplayValues().slice(1).filter(r=>String(r[1])===String(apto)).map(r=>({data:r[0],quarto:String(r[1]),remetente:r[2],msg:r[3],atendente:r[4]}));
    return jsonOut({chats,staffOnline:true,orderStatus:null});
  }
  if(q==="poll_internal"){
    const codigo=e.parameter.codigo; const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh); const c=userCols(sh); const users=sh.getDataRange().getValues(); let notifs=[];
    for(let i=1;i<users.length;i++){if(String(users[i][c.codigo-1]).trim()===String(codigo).trim()){notifs=parseJSONCell(users[i][c.notificacoes-1],[]);break;}}
    const chats=getSheetOrCreate(ss,"Chat",["Data","Quarto","Remetente","Mensagem","Atendente"]).getDataRange().getDisplayValues().slice(1).map(r=>({data:r[0],quarto:String(r[1]),remetente:r[2],msg:r[3],atendente:r[4]}));
    return jsonOut({chats,notifications:notifs,ordersCount:getSheetOrCreate(ss,"Pedidos").getLastRow(),pendingOrders:0});
  }
  if(q==="guests"){
    const data=getSheetOrCreate(ss,"Hospedes",["Data","Nome","Celular","Apto"]).getDataRange().getValues().slice(1);
    return jsonOut(data.map(r=>({data:r[0] instanceof Date?Utilities.formatDate(r[0],"GMT-3","dd/MM/yyyy HH:mm"):r[0],nome:r[1],celular:r[2],apto:String(r[3])})).reverse());
  }
  if(q==="store_status"){
    const params=getStoreParams();
    return jsonOut({
      success:true,
      open:params.open,
      manual:params.manual,
      status:params.status,
      autoStart:params.autoStart,
      autoEnd:params.autoEnd,
      params
    });
  }
  if(q==="init_data"){
    const userSh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(userSh); const c=userCols(userSh); const udata=userSh.getDataRange().getValues().slice(1);
    let staffOnline=false; const users=udata.map((r,i)=>{if(r[c.status-1]==="Online")staffOnline=true; return userObject(r,i+2,c);});
    let params=getStoreParams();
    const cardSh=getSheetOrCreate(ssCardapio(),"Cardapio",["Categoria","Nome","Meta","Descricao","Preco","Imagem","Opcoes","Estoque","Tag","Tipo","Combo"]);
    const card=cardSh.getDataRange().getValues().slice(1).map((r,i)=>({linha:i+2,categoria:r[0],nome:r[1],meta:r[2],desc:r[3],preco:parseFloat(String(r[4]).replace(",","."))||0,imagem:r[5],opcoes:r[6]?String(r[6]).split(",").map(x=>x.trim()).filter(Boolean):[],opcoesRaw:r[6]||"",estoque:r[7]!==""?parseInt(r[7],10):null,tag:r[8]||"Item",tipo:r[9]||"Item",combo:r[10]||""}));
    return jsonOut({users,cardapio:card,params,staffOnline});
  }
  if(q==="orders"){
    const sh=getSheetOrCreate(ss,"Pedidos",["Data/Hora","Hóspede","Quarto","Pedido","Total","Status Impressao","Local de Consumo","Atendente","Status pedido","Observação"]);
    const lastRow=sh.getLastRow();
    const lastCol=Math.max(sh.getLastColumn(),10);
    if(lastRow<2)return jsonOut([]);
    const values=sh.getRange(1,1,lastRow,lastCol).getValues();
    const display=sh.getRange(1,1,lastRow,lastCol).getDisplayValues();
    const headers=display[0].map(h=>String(h||"").trim());
    const headerMap={"Data/Hora":"data","Hóspede":"nome","Hospede":"nome","Quarto":"quarto","Pedido":"pedido","Total":"total","# Total":"total","Status Impressao":"status","Local de Consumo":"local","Atendente":"atendente","Status pedido":"status_pedido","Observação":"observacao","Observacao":"observacao"};
    const out=[];
    for(let r=1;r<values.length;r++){
      const obj={linha_planilha:r+1};
      for(let i=0;i<headers.length;i++){
        const h=headers[i]||("Coluna "+(i+1));
        const key=headerMap[h]||normalizeKey(h);
        const raw=values[r][i];
        obj[key]=(key==="data"&&raw instanceof Date)?Utilities.formatDate(raw,"GMT-3","dd/MM/yyyy HH:mm"):display[r][i];
      }
      if(Object.keys(obj).some(k=>k!=="linha_planilha" && String(obj[k]||"").trim()!==""))out.push(obj);
    }
    return jsonOut(out);
  }
  if(q==="changelog"){const sh=ss.getSheetByName("Changelog"); if(!sh)return jsonOut([]); const rows=sh.getDataRange().getDisplayValues().slice(1); return jsonOut(rows.map((r,i)=>({linha_planilha:i+2,data:r[0]||"",versao:r[1]||"",log:r[2]||""})).filter(r=>r.data||r.versao||r.log).reverse());}
  if(q==="user_log"){requireMaster(e.parameter.nivel); const sh=getSheetOrCreate(ss,"Usuarios",USER_DEFAULT_HEADERS); ensureUserColumns(sh); const c=userCols(sh); const data=sh.getDataRange().getValues(); for(let i=1;i<data.length;i++){if(String(data[i][c.codigo-1]).trim()===String(e.parameter.codigo).trim())return jsonOut(parseJSONCell(data[i][c.log-1],[]));} return jsonOut([]);}
  return jsonOut({success:false,error:"Query desconhecida"});
}
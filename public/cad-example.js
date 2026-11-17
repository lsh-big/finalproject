export const cadExample={
 schemaVersion:1,source:{kind:'virtual',description:'AutoCAD에서 추출하지 않은 가상 예제입니다. 좌표는 화면 시연용이며 도면 단위는 확인되지 않았습니다.'},
 files:[{id:'demo-a',name:'가상_제어반_A.dwg',layouts:['Model']},{id:'demo-b',name:'가상_제어반_B.dwg',layouts:['Model']}],
 objects:[
  {fileId:'demo-a',handle:'10',layout:'Model',blockName:'DEMO_TITLE',position:[10,10,0],attributes:{SITE:'가상 현장 A',DWG_NO:''}},
  {fileId:'demo-a',handle:'21',layout:'Model',blockName:'DEMO_COIL',position:[30,60,0],attributes:{TAG:'KM1',PART_NO:'MC-001',SPEC:'가상 AC220V',QTY:'1'}},
  {fileId:'demo-a',handle:'22',layout:'Model',blockName:'DEMO_COIL',position:[100,60,0],attributes:{TAG:'KM1',PART_NO:'MC-001',SPEC:'가상 AC220V',QTY:'1'}},
  {fileId:'demo-a',handle:'23',layout:'Model',blockName:'DEMO_CONTACT',position:[170,60,0],attributes:{TAG:'KM1',PART_NO:'AUX-001',SPEC:'가상 1NO',QTY:'1'}},
  {fileId:'demo-a',handle:'24',layout:'Model',blockName:'DEMO_BREAKER',position:[30,130,0],attributes:{TAG:'QF1',PART_NO:'CB-001',SPEC:'가상 2P',QTY:'2'}},
  {fileId:'demo-a',handle:'25',layout:'Model',blockName:'DEMO_RELAY',position:[100,130,0],attributes:{TAG:'',PART_NO:'RY-001',SPEC:'가상 DC24V',QTY:'1'}},
  {fileId:'demo-a',handle:'26',layout:'Model',blockName:'DEMO_COIL',position:[170,130,0],attributes:{TAG:'KM3',PART_NO:'',SPEC:'가상 AC220V',QTY:''}},
  {fileId:'demo-a',handle:'27',layout:'Model',blockName:'DEMO_TERMINAL',position:[30,200,0],attributes:{TAG:'X1',PART_NO:'TB-001',SPEC:'가상 2.5mm²',QTY:'3'}},
  {fileId:'demo-a',handle:'28',layout:'Model',blockName:'DEMO_NOTE',position:[170,200,0],attributes:{TEXT:'집계 제외 안내 블록'}},
  {fileId:'demo-b',handle:'21',layout:'Model',blockName:'DEMO_COIL',position:[40,60,0],attributes:{TAG:'KM2',PART_NO:'MC-001',SPEC:'가상 AC220V',QTY:'1'}}
 ]
};
export const defaultCadRules={mapping:{deviceNumber:'TAG',partNumber:'PART_NO',spec:'SPEC',quantity:'QTY',siteName:'SITE',drawingNumber:'DWG_NO'},required:['deviceNumber','partNumber'],titleRequired:['siteName','drawingNumber'],titleBlocks:['DEMO_TITLE'],excludedBlocks:['DEMO_NOTE'],duplicateExceptions:['DEMO_CONTACT'],duplicateScope:'drawing',caseSensitive:true,quantityMode:'instances',enforceDeviceFormat:false,devicePrefixes:['KM','QF','X']};
export const exampleExternalBom={fileName:'가상_외부부품표.csv',rows:[{partNumber:'MC-001',spec:'가상 AC220V',quantity:2},{partNumber:'CB-001',spec:'가상 2P',quantity:2},{partNumber:'TB-001',spec:'가상 2.5mm²',quantity:1},{partNumber:'EXT-001',spec:'가상 외부 전용',quantity:1}]};

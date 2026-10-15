export type DonationInput = { date: string; donorName: string; studentId: string; amount: string; anonymous: string };
export type DonationRecord = DonationInput & { id: string; updateTime: string };
export type PublicDonation = { id: string; date: string; donorName: string; amount: string };
export type OwnDonation = { id: string; date: string; amount: string };
export type AnonymousPerson = { donorName: string; studentId: string };
export const DONATION_HEADERS = ['후원일', '후원자명', '학번', '후원금액', '익명여부'] as const;
export const EMPTY_DONATION: DonationInput = {date:'',donorName:'',studentId:'',amount:'',anonymous:'x'};

export function readCsv(input: string): string[][] {
  const rows: string[][] = [];let row:string[] = [];let cell = '';let quoted=false;let closed=false;
  const text = input.replace(/^\uFEFF/,'');
  const pushCell = () => {row.push(cell);cell='';closed=false;};
  const pushRow = () => {pushCell();if(row.some(value=>value.trim()))rows.push(row);row=[];};
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){if(char==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=char;continue;}
    if(char==='"'&&cell===''&&!closed){quoted=true;continue;}
    if(char===','||char==='\n'||char==='\r'){if(char===',')pushCell();else{if(char==='\r'&&text[i+1]==='\n')i++;pushRow();}continue;}
    if(closed&&(char===' '||char==='\t'))continue;
    if(char==='"'||closed)throw Error(String(rows.length+1)+'행 CSV 큰따옴표 형식 오류');
    cell+=char;
  }
  if(quoted)throw Error('CSV 큰따옴표가 닫히지 않았습니다.');
  if(cell||row.length||closed)pushRow();
  return rows;
}
export function validateDonation(row: DonationInput): DonationInput {
  const date=row.date.trim(), donorName=row.donorName.trim(),studentId=row.studentId.trim();
  const amount=row.amount.replaceAll(',','').trim();
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T00:00:00Z'))||
    new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('후원일을 YYYY-MM-DD로 입력해 주세요.');
  if(donorName.length>80||(studentId!==''&&!/^\d{10}$/.test(studentId)))throw Error('후원자명은 80자 이하, 학번은 빈칸 또는 숫자 10자리여야 합니다.');
  if(!/^\d{1,12}$/.test(amount)||BigInt(amount)<1n||BigInt(amount)>1000000000000n)throw Error('후원금액은 양의 정수여야 합니다.');
  return {date,donorName,studentId,amount:String(BigInt(amount)),anonymous:row.anonymous.trim()==='o'?'o':'x'};
}
export function parseDonationCsv(text: string): DonationInput[] {
  const rows=readCsv(text);
  if(rows.length<2)throw Error('헤더와 내역이 있는 CSV 파일을 선택해 주세요.');
  const header=rows.shift()!.map(v=>v.trim());
  if(header.length!==DONATION_HEADERS.length||header.some((name,i)=>name!==DONATION_HEADERS[i]))throw Error('CSV 헤더는 후원일,후원자명,학번,후원금액,익명여부 순서여야 합니다.');
  if(rows.length>1000)throw Error('CSV는 한 번에 1,000건까지 등록할 수 있습니다.');
  return rows.map((cells,i)=>{
    if(cells.length!==5)throw Error(String(i+2)+'행 CSV 열 개수를 확인해 주세요.');
    try{return validateDonation({date:cells[0],donorName:cells[1],studentId:cells[2],amount:cells[3],anonymous:cells[4]});}
    catch(error){throw Error(String(i+2)+'행: '+(error instanceof Error?error.message:'내용 오류'));}
  });
}
function quoteCsv(value: string) {
  const safe=/^[=+\-@\t\r]/.test(value)?"'"+value:value;
  return '"'+safe.replaceAll('"','""')+'"';
}
export function serializeDonationCsv(rows: readonly DonationInput[]) {
  return '\uFEFF'+[...([DONATION_HEADERS] as readonly (readonly string[])[]),
    ...rows.map(r=>[r.date,r.donorName,r.studentId,r.amount,r.anonymous])].map(row=>row.map(quoteCsv).join(',')).join('\r\n');
}
export function displayAmount(amount:string){return BigInt(amount).toLocaleString('ko-KR')+'원';}
export function displayDate(value:string){return value.replaceAll('-','. ')+'.';}

export function sumDonationAmounts(rows: readonly Pick<OwnDonation,'amount'>[]): string {
  return rows.reduce((total,row)=>total+BigInt(row.amount),0n).toString();
}
export function donationDateRange(rows: readonly Pick<DonationInput,'date'>[]): {start:string;end:string}|null {
  if(!rows.length)return null;
  const sorted=rows.map(row=>row.date).sort();
  return {start:sorted[0],end:sorted[sorted.length-1]};
}

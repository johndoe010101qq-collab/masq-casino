// The SDK only displays approval. Only a reconciled server receipt credits funds.
export async function runHuevoWalletOperation(connection,session,operation,{confirm=false}={}) {
 if(operation.kind==='deposit'){
  const payment=await connection.request('/deposits',{id:operation.id,amount:operation.amount});
  if(confirm&&payment.status==='pending')try{await connection.sdk.confirmPayment(payment.intentId);}catch{}
  const result=await connection.request('/deposits/'+payment.intentId,{});
  if(result.wallet)session.syncWallet(result.wallet);return result;
 }
 const result=await connection.request('/withdrawals',{id:operation.id,amount:operation.amount});
 if(result.wallet)session.syncWallet(result.wallet);return result;
}

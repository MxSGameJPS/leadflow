// These checks exercise the generated UI. No order is submitted or WhatsApp opened.
export async function auditProductJourney(browser,url,contract={},site={}) {
  if(contract.type!=="delivery")return {available:false,pass:false,coverage:"not-yet-automated",summary:"A jornada deste segmento ainda requer revisão funcional manual."};
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();page.setDefaultTimeout(5000);
  await page.addInitScript(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async text=>{window.__leadflowCopiedOrder=text}},configurable:true}));
  const steps=[],errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  const check=async(name,action)=>{await action();steps.push(name)};
  const id=name=>page.getByTestId(name);
  const openCart=async()=>{try{await id('cart-item').first().waitFor({state:'visible',timeout:500})}catch{await id('cart-open').first().click();await id('cart-item').first().waitFor()}};
  const require= (condition,message)=>{if(!condition)throw new Error(message)};
  // Block mutations and external navigation even if generated UI misbehaves.
  await context.route('**/*',async route=>{
    const req=route.request();
    if(!['GET','HEAD'].includes(req.method())||(req.isNavigationRequest()&&!req.url().startsWith(url)))return route.abort();
    return route.continue();
  });
  try {
    await page.goto(url,{waitUntil:"networkidle",timeout:30000});
    await check("catalog",async()=>{require(await id('product-card').count()>0,"Nenhum produto selecionável");require(await id('category-filter').count()>1,"Categorias insuficientes")});
    await check("category filtering",async()=>{
      const before=await id('product-card').allTextContents();
      await id('category-filter').last().click();
      const after=await id('product-card').allTextContents();
      require(after.length>0&&JSON.stringify(before)!==JSON.stringify(after),'Filtro não alterou o catálogo');
      await page.reload({waitUntil:'networkidle'});
    });
    await check("product configuration",async()=>{
      await id('product-card').first().click();
      await id('product-quantity').fill('2');await id('product-note').fill('Sem cebola — teste QA');
      if(await id('product-addon').count())await id('product-addon').first().check();
      await id('add-to-cart').click();
      await id('cart-count').filter({hasText:'2'}).first().waitFor();
    });
    await check("persistence",async()=>{await page.reload({waitUntil:'networkidle'});await id('cart-count').filter({hasText:'2'}).first().waitFor()});
    await check("cart editing",async()=>{
      await openCart();await id('cart-item').first().waitFor();
      const before=await id('cart-subtotal').first().textContent();
      await id('cart-increase').first().click();await id('cart-count').filter({hasText:'3'}).first().waitFor();
      require(await id('cart-subtotal').first().textContent()!==before,'Subtotal não mudou');
      await id('cart-decrease').first().click();await id('cart-count').filter({hasText:'2'}).first().waitFor();
    });
    await check("cart removal",async()=>{
      await id('cart-remove').first().click();
      require(await id('cart-item').count()===0,'Remoção não atualizou o carrinho');
      await page.reload({waitUntil:'networkidle'});
      await id('product-card').first().click();await id('product-quantity').fill('2');await id('product-note').fill('Sem cebola — teste QA');
      await id('add-to-cart').click();await openCart();
    });
    await check("empty checkout rejected",async()=>{
      await id('checkout-open').click();await id('checkout-submit').click();
      require(await id('order-summary').count()===0&&await id('whatsapp-order').count()===0,'Finalização liberada com dados vazios');
      const invalid=await page.locator('input:invalid,select:invalid,textarea:invalid').count();
      require(invalid>0||(await id('checkout-errors').textContent().catch(()=>''))?.trim(),'Nenhuma validação visível');
    });
    await check("delivery address required",async()=>{
      await page.locator('[name="customerName"]').fill('Cliente de teste');
      await page.locator('[name="phone"]').fill('51999999999');
      await page.locator('[name="fulfillment"]').selectOption('delivery');
      await page.locator('[name="payment"]').selectOption('pix');
      await id('checkout-submit').click();
      require(await id('order-summary').count()===0&&await id('whatsapp-order').count()===0,'Entrega aceita sem endereço');
      require(await page.locator('[name="address"]:invalid').count()>0||(await id('checkout-errors').textContent().catch(()=>''))?.trim(),'Endereço ausente sem erro visível');
      await page.locator('[name="address"]').fill('Rua de teste, 123');
    });
    await check("cash change validation",async()=>{
      await page.locator('[name="payment"]').selectOption('cash');
      await page.locator('[name="changeFor"]').fill('-1');await id('checkout-submit').click();
      require(await id('order-summary').count()===0,'Troco negativo aceito');
      await page.locator('[name="changeFor"]').fill('0.01');await id('checkout-submit').click();
      require(await id('order-summary').count()===0,'Troco inferior ao subtotal aceito');
      await page.locator('[name="changeFor"]').fill('0');
    });
    await check("pickup without address",async()=>{
      await page.locator('[name="fulfillment"]').selectOption('pickup');
      await id('checkout-submit').click();await id('order-summary').waitFor();
      const summary=await id('order-summary').textContent();
      require(/retirada/i.test(summary)&&!summary.includes('Rua de teste'),'Retirada manteve endereço de entrega');
      await page.reload({waitUntil:'networkidle'});
      await openCart();await id('checkout-open').click();
      await page.locator('[name="customerName"]').fill('Cliente de teste');
      await page.locator('[name="phone"]').fill('51999999999');
      await page.locator('[name="fulfillment"]').selectOption('delivery');
      await page.locator('[name="address"]').fill('Rua de teste, 123');
      await page.locator('[name="payment"]').selectOption('pix');
    });
    await check("order summary and WhatsApp",async()=>{
      await id('checkout-submit').click();await id('order-summary').waitFor();
      const summary=await id('order-summary').textContent();
      for(const value of ['Cliente de teste','51999999999','Rua de teste','Sem cebola'])require(summary.includes(value),'Resumo não contém '+value);
      require(/2|duas/i.test(summary)&&/pix/i.test(summary),'Quantidade ou pagamento ausentes');
      if(!site.whatsapp){require(await id('whatsapp-order').count()===0,'Destino inventado sem contato verificado');require(await id('order-copy').count()>0,'Pedido sem contato precisa oferecer cópia');await id('order-copy').click();await page.waitForFunction(()=>Boolean(window.__leadflowCopiedOrder));const copied=await page.evaluate(()=>window.__leadflowCopiedOrder);for(const value of ['Cliente de teste','51999999999','Rua de teste','Sem cebola'])require(copied.includes(value),'Cópia incompleta: '+value);return;}
      const href=await id('whatsapp-order').getAttribute('href');
      const target=new URL(href);require(target.hostname==='wa.me'||target.hostname==='api.whatsapp.com','Destino WhatsApp inválido');
      const text=target.searchParams.get('text')||'';
      for(const value of ['Cliente de teste','51999999999','Rua de teste','Sem cebola'])require(text.includes(value),'Resumo não contém '+value);
      require(/2|duas/i.test(text)&&/pix/i.test(text),'Quantidade/pagamento ausentes do pedido');
    });
    require(errors.length===0,'Erros de runtime: '+errors.join(' | '));
    return {available:true,pass:true,coverage:"delivery-core",steps,summary:"Jornada de pedido testada sem enviar mensagem."};
  } catch(error){return {available:true,pass:false,coverage:"delivery-core",steps,summary:error.message,errors}}
  finally{await context.close()}
}

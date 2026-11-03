const i=(n,r)=>{const e=String(n||"free").trim().toLowerCase();if(e==="free")return"free";if(!r)return e;const t=Date.parse(r);return Number.isFinite(t)&&t<=Date.now()?"free":e};export{i as g};

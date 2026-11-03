import{d as u}from"./index-SKkfIv-G.js";import{r,j as e}from"./react-vendor--CgM7R3s.js";import{S as x}from"./skeleton-CfMkjPUs.js";/**
 * @license lucide-react v0.462.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const y=u("BellRing",[["path",{d:"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9",key:"1qo2s2"}],["path",{d:"M10.3 21a1.94 1.94 0 0 0 3.4 0",key:"qgo35s"}],["path",{d:"M4 2C2.8 3.7 2 5.7 2 8",key:"tap9e0"}],["path",{d:"M22 8c0-2.3-.8-4.3-2-6",key:"5bb3ad"}]]),b=({src:n,alt:c="Announcement media",className:l="",wrapperClassName:i="",onError:a,...d})=>{const[t,s]=r.useState(!1),[o,m]=r.useState(!1);return e.jsxs("div",{className:`relative overflow-hidden rounded-xl ${i}`,children:[!t&&!o&&e.jsx(x,{className:"absolute inset-0 h-full w-full min-h-[180px] rounded-xl bg-muted/70 animate-pulse"}),e.jsx("img",{src:o?"https://placehold.co/600x400/cccccc/333333?text=Image+Not+Available":n,alt:c,loading:"lazy",onLoad:()=>s(!0),onError:p=>{m(!0),s(!0),a&&a(p)},className:`transition-opacity duration-300 ${t?"opacity-100":"opacity-0"} ${l}`,...d})]})};export{b as A,y as B};

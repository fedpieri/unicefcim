/* ═══════════════════════════════════════════════════════
   UNICEF PF4C · Globe module
   Texture: webgl-globe (dataarts) via jsdelivr CDN
   ═════════════════════════════════════════════════════ */

let _scene, _camera, _renderer, _G, _globeMat;
let _hitObjs = [], _allRings = [], _roObserver = null;
let _dragging = false, _dragDist = 0;
let _prev = {x:0,y:0}, _vel = {x:0,y:0};
let _autoRot = true, _autoTimer = null, _rafId = null;
let _cloudsRef = null;

function ll2v3(lat, lng, r=2) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
     r * Math.cos(phi),
     r * Math.sin(phi) * Math.sin(theta)
  );
}

function buildGlobe() {
  const el = document.getElementById('globe-wrap');
  if (!el) return;

  /* ── Teardown previous instance ── */
  if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
  if (_roObserver) { _roObserver.disconnect(); _roObserver = null; }
  if (_renderer) {
    _renderer.dispose();
    if (_renderer.domElement.parentNode) _renderer.domElement.parentNode.removeChild(_renderer.domElement);
  }
  _hitObjs = []; _allRings = []; _cloudsRef = null;

  const W = el.clientWidth  || window.innerWidth;
  const H = el.clientHeight || window.innerHeight;

  /* ── Scene ── */
  _scene  = new THREE.Scene();
  _camera = new THREE.PerspectiveCamera(42, W/H, 0.1, 500);
  _camera.position.z = 5.6;

  _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  _renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  _renderer.setClearColor(0x000000, 0);
  // setSize(W, H) — default 3rd arg true → updates canvas CSS size too
  _renderer.setSize(W, H);
  _renderer.domElement.style.position = 'absolute';
  _renderer.domElement.style.top = '0';
  _renderer.domElement.style.left = '0';
  el.insertBefore(_renderer.domElement, el.firstChild);

  /* ── Stars (dark mode only) ── */
  if (document.body.classList.contains('light') === false) {
    const sv = [];
    for (let i=0; i<2000; i++)
      sv.push((Math.random()-.5)*280, (Math.random()-.5)*280, (Math.random()-.5)*280);
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(sv, 3));
    _scene.add(new THREE.Points(sg, new THREE.PointsMaterial({color:0x6688bb, size:.13, transparent:true, opacity:.45})));
  }

  /* ── Lighting — even, no harsh sun ── */
  _scene.add(new THREE.AmbientLight(0xffffff, 2.2));
  const d1 = new THREE.DirectionalLight(0xfff8f0, 0.6); d1.position.set(5,3,4);   _scene.add(d1);
  const d2 = new THREE.DirectionalLight(0xf0f4ff, 0.4); d2.position.set(-4,-2,-3); _scene.add(d2);

  /* ── Globe group ── */
  _G = new THREE.Group();
  _scene.add(_G);

  /* ── Lambert material — purely diffuse, zero specular ── */
  _globeMat = new THREE.MeshLambertMaterial({ color: 0x2255aa });
  _G.add(new THREE.Mesh(new THREE.SphereGeometry(2, 75, 75), _globeMat));

  /* ── Textures from webgl-globe (dataarts) via jsdelivr ── */
  const tl = new THREE.TextureLoader(); tl.crossOrigin = 'anonymous';
  const WGLOBE = 'https://cdn.jsdelivr.net/gh/dataarts/webgl-globe@master/globe/';
  const TG     = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/';

  // Day texture (bright, clear) from webgl-globe repo
  tl.load(WGLOBE + 'world.jpg',
    t => { _globeMat.map = t; _globeMat.needsUpdate = true; },
    undefined,
    // Fallback: NASA blue marble from three-globe
    () => tl.load(TG + 'earth-blue-marble.jpg', t => { _globeMat.map = t; _globeMat.needsUpdate = true; })
  );

  // Bump map for terrain relief
  tl.load(TG + 'earth-topology.png',
    t => { _globeMat.bumpMap = t; _globeMat.bumpScale = 0.004; _globeMat.needsUpdate = true; }
  );

  /* ── Atmosphere shader ── */
  const atmosVert = `varying vec3 vN; void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
  const atmosFrag = `varying vec3 vN; void main(){float i=pow(.78-dot(vN,vec3(0.,0.,1.)),5.);gl_FragColor=vec4(.15,.55,1.,1.)*i;}`;
  _scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(2.15, 64, 64),
    new THREE.ShaderMaterial({ vertexShader:atmosVert, fragmentShader:atmosFrag, side:THREE.BackSide, blending:THREE.AdditiveBlending, transparent:true })
  ));

  /* ── Subtle lat/lng grid ── */
  _G.add(new THREE.Mesh(
    new THREE.SphereGeometry(2.012, 28, 14),
    new THREE.MeshBasicMaterial({ color:0xffffff, wireframe:true, transparent:true, opacity:0.03 })
  ));

  /* ── Orbital ring ── */
  const ring2 = new THREE.Mesh(
    new THREE.RingGeometry(2.38, 2.392, 180),
    new THREE.MeshBasicMaterial({ color:0x1CABE2, transparent:true, opacity:0.06, side:THREE.DoubleSide })
  );
  ring2.rotation.x = Math.PI * .22;
  ring2.rotation.z = Math.PI * .08;
  _scene.add(ring2);

  /* ── Country markers ── */
  Object.keys(COORDS).forEach((iso3) => {
    const [lat, lng] = COORDS[iso3];
    const pos = ll2v3(lat, lng, 2.055);
    const out = pos.clone().normalize();
    const q   = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1), out);
    const region = COUNTRY_META[iso3]?.region || 'Other';
    const col = parseInt((REGION_COLORS[region] || '#1CABE2').slice(1), 16);

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(.016, 8, 8),
      new THREE.MeshBasicMaterial({ color: col })
    );
    dot.position.copy(pos); _G.add(dot);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(.046, .006, 8, 24),
      new THREE.MeshBasicMaterial({ color: col, transparent:true, opacity:.7 })
    );
    ring.position.copy(pos); ring.quaternion.copy(q);
    _G.add(ring); _allRings.push(ring);

    const hit = new THREE.Mesh(
      new THREE.SphereGeometry(.11, 6, 6),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    hit.position.copy(pos); hit.userData = { iso3 };
    _G.add(hit); _hitObjs.push(hit);
  });

  /* ── Raycaster & interaction ── */
  const rc = new THREE.Raycaster();

  const ndc = (cx, cy) => {
    const r = _renderer.domElement.getBoundingClientRect();
    return new THREE.Vector2(
      ((cx - r.left) / r.width)  *  2 - 1,
     -((cy - r.top)  / r.height) * 2 + 1
    );
  };

  const onDown = e => {
    const {clientX:x, clientY:y} = e.touches?.[0] || e;
    _dragging = true; _dragDist = 0; _prev = {x,y}; _vel = {x:0,y:0};
    clearTimeout(_autoTimer); _autoRot = false;
  };

  const onMove = e => {
    const {clientX:x, clientY:y} = e.touches?.[0] || e;
    if (_dragging) {
      const dx=x-_prev.x, dy=y-_prev.y;
      _dragDist += Math.hypot(dx,dy);
      _vel.y = dx*.006; _vel.x = dy*.006;
      _G.rotation.y += _vel.y;
      _G.rotation.x = Math.max(-1.1, Math.min(1.1, _G.rotation.x + _vel.x));
      _prev = {x,y};
    } else {
      rc.setFromCamera(ndc(x,y), _camera);
      const h = rc.intersectObjects(_hitObjs);
      if (h.length) showTooltip(getInfo(h[0].object.userData.iso3), x, y);
      else           hideTooltip();
    }
  };

  const onUp = e => {
    const {clientX:x, clientY:y} = e.changedTouches?.[0] || e;
    if (!_dragging) return;
    _dragging = false;
    if (_dragDist < 6) {
      rc.setFromCamera(ndc(x,y), _camera);
      const h = rc.intersectObjects(_hitObjs);
      if (h.length) { hideTooltip(); showCountry(h[0].object.userData.iso3); }
    }
    _autoTimer = setTimeout(() => _autoRot = true, 4200);
  };

  _renderer.domElement.addEventListener('mousedown',  onDown);
  _renderer.domElement.addEventListener('touchstart', onDown, {passive:true});
  window.addEventListener('mousemove', onMove);
  window.addEventListener('touchmove', onMove, {passive:true});
  window.addEventListener('mouseup',   onUp);
  window.addEventListener('touchend',  onUp);

  /* ── ResizeObserver — updates camera every frame of CSS transition ── */
  _roObserver = new ResizeObserver(() => {
    const w = el.clientWidth, h = el.clientHeight;
    if (w > 0 && h > 0) {
      _camera.aspect = w / h;
      _camera.updateProjectionMatrix();
      // true (default) → also updates canvas CSS width/height → no oval distortion
      _renderer.setSize(w, h);
    }
  });
  _roObserver.observe(el);

  /* ── Animation loop ── */
  let t = 0;
  function animate() {
    _rafId = requestAnimationFrame(animate);
    t += .016;

    if (_autoRot && !_dragging) {
      _G.rotation.y += .0014;
    } else if (!_dragging) {
      _vel.x *= .91; _vel.y *= .91;
      _G.rotation.y += _vel.y;
      _G.rotation.x = Math.max(-1.1, Math.min(1.1, _G.rotation.x + _vel.x));
    }

    ring2.rotation.z += .0003;

    _allRings.forEach((r,i) => {
      r.material.opacity  = .45 + .3  * Math.sin(t*1.5 + i*.52);
      r.scale.setScalar(     .88 + .18 * Math.sin(t*1.2 + i*.4));
    });

    _renderer.render(_scene, _camera);
  }
  animate();
}

/* ── Tooltip ── */
function showTooltip(info, x, y) {
  const t = document.getElementById('tooltip');
  t.textContent = info.flag + ' ' + (info.n||'') + ' · ' + (info.region||'');
  t.style.display = 'block';
  t.style.left = (x+14) + 'px';
  t.style.top  = (y-44) + 'px';
}
function hideTooltip() {
  document.getElementById('tooltip').style.display = 'none';
}

/* ── Legend ── */
function buildLegend() {
  document.getElementById('legend-rows').innerHTML =
    Object.entries(REGION_COLORS).map(([r,c]) =>
      `<div class="leg-row"><div class="leg-dot" style="background:${c}"></div>${r}</div>`
    ).join('');
}

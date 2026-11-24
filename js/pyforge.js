

    const STORAGE_KEY = 'PyForge_single_file_projects_v2';
    const DEFAULT_PROJECTS = [{"id":"proj-default","name":"Untitled Project","description":"","entryFile":"main.py","updatedAt":1795057187407,"files":[{"path":"main.py","content":""}]}];
    let projects = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') || DEFAULT_PROJECTS;
    let activeProjectId = projects[0].id;
    let activeFilePath = projects[0].entryFile || projects[0].files[0].path;

    const projectSelect = document.getElementById('projectSelect');
    const fileList = document.getElementById('fileList');
    const tabBar = document.getElementById('tabBar');
    const editor = document.getElementById('editor');
    const highlightLayer = document.getElementById('highlightLayer');
    const gutter = document.getElementById('gutter');
    const consolePane = document.getElementById('consolePane');
    const statusText = document.getElementById('statusText');
    const runBtn = document.getElementById('runBtn');
    const stopBtn = document.getElementById('stopBtn');
    const stdinForm = document.getElementById('stdinForm');
    const stdinInput = document.getElementById('stdinInput');
    const stdinSendBtn = document.getElementById('stdinSendBtn');

    function escapeHtml(s) {
      return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    const PY_KEYWORDS = new Set([
      'and','as','assert','async','await','break','class','continue','def','del','elif','else',
      'except','finally','for','from','global','if','import','in','is','lambda','nonlocal',
      'not','or','pass','raise','return','try','while','with','yield','match','case'
    ]);
    const PY_CONSTS = new Set(['True','False','None','self','cls']);
    const PY_BUILTINS = new Set([
      'print','input','len','range','int','str','float','bool','list','dict','set','tuple',
      'open','enumerate','zip','map','filter','sum','min','max','abs','round','type',
      'isinstance','issubclass','super','sorted','reversed','any','all','chr','ord','hex',
      'bin','oct','format','repr','id','dir','vars','getattr','setattr','hasattr','next','iter'
    ]);

    function highlightPython(code) {
      const tokenRe = /(#[^\n]*)|([fFrRbBuU]{0,2}(?:"""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'))|(@[A-Za-z_][A-Za-z0-9_.]*)|(\b0[xXoObB][0-9a-fA-F_]+\b|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g;
      let out = '';
      let last = 0;
      let prevWord = '';
      let m;
      while ((m = tokenRe.exec(code)) !== null) {
        if (m.index > last) out += escapeHtml(code.slice(last, m.index));
        const [full, comment, str, dec, num, ident] = m;
        if (comment) {
          out += '<span class="tok-comment">' + escapeHtml(comment) + '</span>';
        } else if (str) {
          out += '<span class="tok-string">' + escapeHtml(str) + '</span>';
        } else if (dec) {
          out += '<span class="tok-decorator">' + escapeHtml(dec) + '</span>';
        } else if (num) {
          out += '<span class="tok-number">' + escapeHtml(num) + '</span>';
        } else if (ident) {
          if (PY_KEYWORDS.has(ident)) {
            out += '<span class="tok-keyword">' + escapeHtml(ident) + '</span>';
          } else if (PY_CONSTS.has(ident)) {
            out += '<span class="tok-const">' + escapeHtml(ident) + '</span>';
          } else if (prevWord === 'def' || prevWord === 'class') {
            out += '<span class="tok-func">' + escapeHtml(ident) + '</span>';
          } else if (PY_BUILTINS.has(ident)) {
            out += '<span class="tok-builtin">' + escapeHtml(ident) + '</span>';
          } else {
            out += escapeHtml(ident);
          }
          prevWord = ident;
        }
        if (!ident) prevWord = '';
        last = tokenRe.lastIndex;
      }
      if (last < code.length) out += escapeHtml(code.slice(last));
      return out + (code.endsWith('\n') ? ' ' : '');
    }

    function updateHighlight() {
      const file = getFile();
      const isPy = !file || file.path.endsWith('.py');
      highlightLayer.innerHTML = isPy ? highlightPython(editor.value) : escapeHtml(editor.value) + ' ';
      highlightLayer.scrollTop = editor.scrollTop;
      highlightLayer.scrollLeft = editor.scrollLeft;
    }

    const ANSI_COLORS = {
      30: '#475569', 31: '#f87171', 32: '#4ade80', 33: '#facc15',
      34: '#60a5fa', 35: '#c084fc', 36: '#22d3ee', 37: '#f1f5f9',
      90: '#64748b', 91: '#fca5a5', 92: '#86efac', 93: '#fde047',
      94: '#93c5fd', 95: '#d8b4fe', 96: '#67e8f9', 97: '#ffffff'
    };

    function renderAnsiHtml(text) {
      const parts = text.split(/(\x1b\[[0-9;]*m)/g);
      let html = '';
      let color = null;
      let bold = false;
      for (const p of parts) {
        const m = /^\x1b\[([0-9;]*)m$/.exec(p);
        if (m) {
          const codes = m[1] ? m[1].split(';').map(Number) : [0];
          for (const c of codes) {
            if (c === 0) { color = null; bold = false; }
            else if (c === 1) bold = true;
            else if (ANSI_COLORS[c]) color = ANSI_COLORS[c];
          }
        } else if (p) {
          const clean = escapeHtml(p.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, ''));
          if (color || bold) {
            html += '<span style="' + (color ? 'color:' + color + ';' : '') + (bold ? 'font-weight:600;' : '') + '">' + clean + '</span>';
          } else {
            html += clean;
          }
        }
      }
      return html;
    }

    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(projects)); }
    function getProject() { return projects.find(p => p.id === activeProjectId) || projects[0]; }
    function getFile() {
      const proj = getProject();
      return proj.files.find(f => f.path === activeFilePath) || proj.files[0];
    }

    function updateGutter() {
      const lines = editor.value.split('\n').length;
      let html = '';
      for (let i = 1; i <= lines; i++) html += '<div>' + i + '</div>';
      gutter.innerHTML = html;
    }

    function appendLog(text, cls = '') {
      const div = document.createElement('div');
      div.className = 'log-line' + (cls ? ' ' + cls : '');
      if (!cls && text.includes('\x1b[')) {
        div.innerHTML = renderAnsiHtml(text);
      } else {
        div.textContent = text;
      }
      consolePane.appendChild(div);
      consolePane.scrollTop = consolePane.scrollHeight;
    }

    function appendPreviewHtml(html) {
      const wrap = document.createElement('div');
      wrap.className = 'preview-block';
      const iframe = document.createElement('iframe');
      iframe.setAttribute('sandbox', 'allow-scripts');
      iframe.srcdoc = html;
      wrap.appendChild(iframe);
      consolePane.appendChild(wrap);
      consolePane.scrollTop = consolePane.scrollHeight;
    }

    function appendPreviewImage(dataUrl) {
      const wrap = document.createElement('div');
      wrap.className = 'preview-block';
      const img = document.createElement('img');
      img.src = dataUrl;
      wrap.appendChild(img);
      consolePane.appendChild(wrap);
      consolePane.scrollTop = consolePane.scrollHeight;
    }

    function renderUI() {
      const proj = getProject();
      if (!proj.files.some(f => f.path === activeFilePath)) activeFilePath = proj.files[0]?.path || '';
      projectSelect.innerHTML = projects.map(p => `<option value="${p.id}" ${p.id === proj.id ? 'selected' : ''}>${p.name}</option>`).join('');
      fileList.innerHTML = '';
      proj.files.forEach(f => {
        const isEntry = f.path === proj.entryFile;
        const row = document.createElement('div');
        row.className = 'file-item' + (f.path === activeFilePath ? ' active' : '');
        row.innerHTML = `<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.path}</span>
          <span class="file-meta">
            ${isEntry ? '<span class="entry-tag">entry</span>' : ''}
            ${proj.files.length > 1 ? '<button class="file-action del" title="Delete">×</button>' : ''}
          </span>`;
        row.onclick = (e) => {
          if (e.target.classList.contains('del')) {
            proj.files = proj.files.filter(x => x.path !== f.path);
            if (proj.entryFile === f.path) proj.entryFile = proj.files[0].path;
            save(); renderUI(); return;
          }
          activeFilePath = f.path; renderUI();
        };
        fileList.appendChild(row);
      });
      tabBar.innerHTML = proj.files.map(f => `<div class="tab ${f.path === activeFilePath ? 'active' : ''}" data-path="${f.path}">${f.path}</div>`).join('');
      tabBar.querySelectorAll('.tab').forEach(t => t.onclick = () => { activeFilePath = t.dataset.path; renderUI(); });
      const file = getFile();
      editor.value = file ? file.content : '';
      updateGutter();
      updateHighlight();
    }

    editor.addEventListener('input', () => {
      const file = getFile();
      if (file) { file.content = editor.value; save(); }
      updateGutter();
      updateHighlight();
    });
    editor.addEventListener('scroll', () => {
      gutter.scrollTop = editor.scrollTop;
      highlightLayer.scrollTop = editor.scrollTop;
      highlightLayer.scrollLeft = editor.scrollLeft;
    });
    editor.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); runBtn.click(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        const s = editor.selectionStart, end = editor.selectionEnd;
        editor.value = editor.value.substring(0, s) + '    ' + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = s + 4;
        editor.dispatchEvent(new Event('input'));
      }
    });

    projectSelect.onchange = () => { activeProjectId = projectSelect.value; activeFilePath = getProject().entryFile; renderUI(); };

    const newProjectBar = document.getElementById('newProjectBar');
    const newProjectInput = document.getElementById('newProjectInput');
    document.getElementById('newProjectBtn').onclick = () => {
      newProjectBar.classList.toggle('open');
      if (newProjectBar.classList.contains('open')) newProjectInput.focus();
    };
    document.getElementById('cancelProjectBtn').onclick = () => newProjectBar.classList.remove('open');
    newProjectBar.onsubmit = (e) => {
      e.preventDefault();
      const name = newProjectInput.value.trim();
      if (!name) return;
      const proj = {
        id: 'proj-' + Date.now(),
        name,
        description: '',
        entryFile: 'main.py',
        updatedAt: Date.now(),
        files: [{ path: 'main.py', content: 'name = input("What is your name? ")\nprint(f"Hello, {name}!")\n' }]
      };
      projects.unshift(proj);
      activeProjectId = proj.id;
      activeFilePath = 'main.py';
      newProjectInput.value = '';
      newProjectBar.classList.remove('open');
      save();
      renderUI();
    };

    const newFileBox = document.getElementById('newFileBox');
    const newFileInput = document.getElementById('newFileInput');
    document.getElementById('newFileBtn').onclick = () => {
      newFileBox.classList.toggle('open');
      if (newFileBox.classList.contains('open')) newFileInput.focus();
    };
    newFileBox.onsubmit = (e) => {
      e.preventDefault();
      const path = newFileInput.value.trim().replace(/^\/+/, '');
      if (!path) return;
      const proj = getProject();
      if (!proj.files.some(f => f.path === path)) {
        proj.files.push({ path, content: '# ' + path + '\n' });
      }
      activeFilePath = path;
      newFileInput.value = '';
      newFileBox.classList.remove('open');
      save();
      renderUI();
    };

    document.getElementById('clearBtn').onclick = () => { consolePane.innerHTML = ''; };

    let pendingStdinResolve = null;
    let pendingStdinReject = null;
    let executionStopped = false;

    function requestInlineStdin(promptText) {
      return new Promise((resolve, reject) => {
        if (promptText) appendLog(String(promptText));
        pendingStdinResolve = resolve;
        pendingStdinReject = reject;
        stdinForm.classList.add('waiting');
        stdinInput.disabled = false;
        stdinSendBtn.disabled = false;
        stdinInput.placeholder = 'Type input and press Enter...';
        stdinInput.focus();
      });
    }

    function resetStdinBar() {
      pendingStdinResolve = null;
      pendingStdinReject = null;
      stdinForm.classList.remove('waiting');
      stdinInput.value = '';
      stdinInput.disabled = true;
      stdinSendBtn.disabled = true;
      stdinInput.placeholder = 'Waiting for program input...';
    }

    stdinForm.onsubmit = (e) => {
      e.preventDefault();
      if (!pendingStdinResolve) return;
      const val = stdinInput.value;
      const resolve = pendingStdinResolve;
      appendLog('> ' + val, 'log-in');
      resetStdinBar();
      resolve(val);
    };

    stopBtn.onclick = () => {
      executionStopped = true;
      if (pendingStdinReject) {
        const rejectInput = pendingStdinReject;
        resetStdinBar();
        rejectInput(new Error('Execution stopped by user.'));
      }
      stopBtn.style.display = 'none';
      runBtn.disabled = false;
      statusText.textContent = 'Stopped';
    };

    window.__PyForgeAsyncInput = (promptText) => requestInlineStdin(promptText);
    window.__PyForgePreview = (type, payload) => {
      if (type === 'html') appendPreviewHtml(payload);
      else if (type === 'image') appendPreviewImage(payload);
      else if (type === 'clear') consolePane.innerHTML = '';
    };

    let pyodide = null;
    let micropipReady = false;

    async function ensurePyodide() {
      if (pyodide) return pyodide;
      statusText.textContent = 'Loading Python...';
      appendLog('Loading Pyodide WebAssembly runtime...', 'log-sys');
      pyodide = await loadPyodide({ indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.4/full/' });
      pyodide.FS.mkdirTree('/pyforge_runtime');

      pyodide.FS.writeFile('/pyforge_runtime/preview.py', `import js
def html(markup: str): js.window.__PyForgePreview("html", str(markup))
def svg(svg_markup: str): html(f'<div style="background:#0b0f17;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;">{svg_markup}</div>')
def clear(): js.window.__PyForgePreview("clear", "")
`, { encoding: 'utf8' });

      pyodide.FS.writeFile('/pyforge_runtime/PyForge_runner.py', `import ast, os, sys, inspect, builtins, js

async def _PyForge_async_input(prompt=""):
    sys.stdout.flush()
    val = await js.window.__PyForgeAsyncInput(str(prompt) if prompt is not None else "")
    return str(val)

def _PyForge_os_system(cmd):
    if str(cmd).strip().lower() in ("cls", "clear"):
        js.window.__PyForgePreview("clear", "")
    return 0

os.system = _PyForge_os_system

def _find_async_functions(tree):
    calls_by_fn = {}
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            callees = set()
            for child in ast.walk(node):
                if isinstance(child, ast.Call):
                    if isinstance(child.func, ast.Name):
                        callees.add(child.func.id)
                    elif isinstance(child.func, ast.Attribute):
                        callees.add(child.func.attr)
            calls_by_fn[node.name] = callees

    async_fns = set()
    triggers = {"input", "getpass"}
    changed = True
    while changed:
        changed = False
        for fn, callees in calls_by_fn.items():
            if fn not in async_fns and (callees & (triggers | async_fns)):
                async_fns.add(fn)
                changed = True
    return async_fns

class _AsyncInputTransformer(ast.NodeTransformer):
    def __init__(self, async_fns):
        self.async_fns = async_fns

    def visit_FunctionDef(self, node):
        self.generic_visit(node)
        if node.name in self.async_fns:
            new_node = ast.AsyncFunctionDef(
                name=node.name,
                args=node.args,
                body=node.body,
                decorator_list=node.decorator_list,
                returns=node.returns,
                type_comment=getattr(node, 'type_comment', None),
            )
            return ast.copy_location(new_node, node)
        return node

    def visit_Call(self, node):
        self.generic_visit(node)
        if isinstance(node.func, ast.Name):
            if node.func.id in ("input", "getpass"):
                new_call = ast.Call(
                    func=ast.Name(id="_PyForge_async_input", ctx=ast.Load()),
                    args=node.args,
                    keywords=node.keywords,
                )
                return ast.copy_location(ast.Await(value=new_call), node)
            if node.func.id in self.async_fns:
                return ast.copy_location(ast.Await(value=node), node)
        elif isinstance(node.func, ast.Attribute) and node.func.attr == "getpass":
            new_call = ast.Call(
                func=ast.Name(id="_PyForge_async_input", ctx=ast.Load()),
                args=node.args,
                keywords=node.keywords,
            )
            return ast.copy_location(ast.Await(value=new_call), node)
        return node

async def run_entry_file(path):
    with open(path, "r", encoding="utf-8") as f:
        source = f.read()
    tree = ast.parse(source, filename=path)
    async_fns = _find_async_functions(tree)
    tree = _AsyncInputTransformer(async_fns).visit(tree)
    ast.fix_missing_locations(tree)

    code_obj = compile(tree, path, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)
    ns = {
        "__name__": "__main__",
        "__file__": path,
        "__builtins__": builtins,
        "_PyForge_async_input": _PyForge_async_input,
    }
    res = eval(code_obj, ns, ns)
    if inspect.iscoroutine(res):
        await res
`, { encoding: 'utf8' });

      await pyodide.runPythonAsync("import sys\nif '/pyforge_runtime' not in sys.path: sys.path.append('/pyforge_runtime')");
      appendLog('Python runtime ready.', 'log-sys');
      return pyodide;
    }

    function rmTree(FS, dir) {
      if (!FS.analyzePath(dir).exists) return;
      for (const e of FS.readdir(dir)) {
        if (e === '.' || e === '..') continue;
        const p = dir + '/' + e;
        if (FS.isDir(FS.stat(p).mode)) { rmTree(FS, p); FS.rmdir(p); }
        else { FS.unlink(p); }
      }
    }

    runBtn.onclick = async () => {
      const proj = getProject();
      const entry = (proj.entryFile || proj.files[0].path).replace(/^\/+/, '');
      executionStopped = false;
      consolePane.innerHTML = '';
      resetStdinBar();
      runBtn.disabled = true;
      stopBtn.style.display = 'inline-block';
      const t0 = performance.now();

      try {
        const py = await ensurePyodide();
        py.setStdout({
          batched: (m) => {
            if (m.includes('\x1b[2J') || m.includes('\x1bc')) consolePane.innerHTML = '';
            const cleaned = m.replace(/\x1b\[2J|\x1b\[H|\x1bc/g, '');
            if (cleaned) appendLog(cleaned);
          }
        });
        py.setStderr({ batched: (m) => appendLog(m, 'log-err') });

        if (py.FS.analyzePath('/workspace').exists) rmTree(py.FS, '/workspace');
        else py.FS.mkdirTree('/workspace');

        for (const f of proj.files) {
          const full = '/workspace/' + f.path.replace(/^\/+/, '');
          const slash = full.lastIndexOf('/');
          if (slash > 10) py.FS.mkdirTree(full.slice(0, slash));
          py.FS.writeFile(full, f.content, { encoding: 'utf8' });
        }

        statusText.textContent = 'Resolving imports...';
        const allCode = proj.files.filter(f => f.path.endsWith('.py')).map(f => f.content).join('\n\n');
        try {
          await py.loadPackagesFromImports(allCode, {
            messageCallback: (m) => appendLog(m, 'log-sys')
          });
        } catch (err) {
          appendLog('Automatic import resolution failed: ' + String(err), 'log-sys');
        }

        statusText.textContent = 'Running...';
        await py.runPythonAsync(`
import os, sys, importlib, base64, io
import PyForge_runner

os.chdir('/workspace')
if '/workspace' in sys.path:
    sys.path.remove('/workspace')
sys.path.insert(0, '/workspace')
for k, v in list(sys.modules.items()):
    if isinstance(getattr(v, '__file__', None), str) and v.__file__.startswith('/workspace'):
        del sys.modules[k]
importlib.invalidate_caches()

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import js
    def _PyForge_show(*args, **kwargs):
        for fig_num in plt.get_fignums():
            fig = plt.figure(fig_num)
            buf = io.BytesIO()
            fig.savefig(buf, format='png', dpi=140, bbox_inches='tight')
            buf.seek(0)
            b64 = base64.b64encode(buf.read()).decode('ascii')
            js.window.__PyForgePreview('image', 'data:image/png;base64,' + b64)
        plt.close('all')
    plt.show = _PyForge_show
except Exception:
    pass

try:
    await PyForge_runner.run_entry_file('/workspace/${entry}')
except SystemExit as _se:
    if _se.code not in (None, 0):
        print(f"Exited with code {_se.code}", file=sys.stderr)
`);
        if (!executionStopped) {
          statusText.textContent = 'Finished in ' + Math.round(performance.now() - t0) + 'ms';
        }
      } catch (err) {
        if (executionStopped) {
          statusText.textContent = 'Stopped';
        } else {
          appendLog(String(err), 'log-err');
          statusText.textContent = 'Error';
        }
      } finally {
        resetStdinBar();
        runBtn.disabled = false;
        stopBtn.style.display = 'none';
      }
    };

    document.getElementById('pkgBtn').onclick = async () => {
      const input = document.getElementById('pkgInput');
      const pkg = input.value.trim();
      if (!pkg) return;
      input.value = '';

      try {
        const py = await ensurePyodide();
        if (!micropipReady) {
          await py.loadPackage('micropip');
          micropipReady = true;
        }
        appendLog('Installing ' + pkg + '...', 'log-sys');
        await py.runPythonAsync('import micropip\nawait micropip.install(' + JSON.stringify(pkg) + ')');
        appendLog('Installed ' + pkg + '.', 'log-sys');
      } catch (err) {
        appendLog(String(err), 'log-err');
      }
    };

    renderUI();
  

var BBGraph = function () {
  this.vertices = {};
  this.edges = [];
};
BBGraph.prototype.addVertex = function(addr, vlen, dom) {
  if (this.vertices[addr] === undefined) {
    this.vertices[addr] = {};
    this.vertices[addr].parents = [];
    this.vertices[addr].children = [];
  }
  if (vlen !== undefined) {
    this.vertices[addr].len = vlen;
    this.vertices[addr].rendered = dom;
  }
};
BBGraph.prototype.addEdge = function(v1, v2, color) {
  this.addVertex(v1);
  this.addVertex(v2);
  this.edges.push({'from': v1, 'to': v2, 'color': color});
  this.vertices[v1].children.push(v2);
  this.vertices[v2].parents.push(v1);
};
BBGraph.prototype.render = function() {
  var name = Object.keys(this.vertices).toString();
  var dot = "digraph graphname {\n";
  var outergbox = document.createElement('div');
  outergbox.id = 'outergbox';
  var bbcanvas = document.getElementById("bb_canvas");
  var gbox = document.createElement('div');
  gbox.id = 'gbox';
  gbox.className = name;
  outergbox.appendChild(gbox);
  bbcanvas.appendChild(outergbox);
  for (var addr in this.vertices) {
    var r = this.vertices[addr].rendered;
    if (r !== undefined) {
      gbox.appendChild(r);
      var width = (r.offsetWidth * 1.0) / 72.0;
      var height = (r.offsetHeight * 1.0) / 72.0;
      dot += 'N' + addr + ' [width="' + width + '", height="' + height + '", shape="box"];\n';
    }
  }
  for (var j = 0; j < this.edges.length; j++) {
    dot += 'N' + this.edges[j].from + ' -> N' + this.edges[j].to + ' [color=' + this.edges[j].color + ', headport=n, tailport=s]' + ";\n";
  }
  dot += "}";
  var gdot = Viz(dot, format="dot", engine="dot", options=null);
  var i;
  var resp = gdot.split('\n').join("").split(";");
  var gdata = resp[0].split('"')[1].split(',');
  gbox.style.width = fnum(gdata[2])+10;
  gbox.style.height = fnum(gdata[3])+10;
  var canvas = document.createElement("canvas");
  canvas.width = fnum(gdata[2])+100;
  canvas.height = fnum(gdata[3])+100;
  canvas.id = "gcanvas";
  gbox.appendChild(canvas);
  var ctx = canvas.getContext("2d");
  for (i = 2; true; i++) {
    if (resp[i].indexOf('}') != -1) break;
    else if (resp[i].indexOf('->') != -1) {
      // this is an edge (->), get color and pos
      var color = resp[i].substr(resp[i].indexOf('color=')+6).split(',')[0];
      var posstr = resp[i].substr(resp[i].indexOf('pos="')+7).split('"')[0].split(' ');
      var pos = [];
      // get origin(x,y) and dest(x,y)
      for (var k=0; k<(posstr.length); k++) {
        var to = posstr[k].split(',');
        pos.push({x:parseFloat(to[0]), y:fnum(gdata[3]) - parseFloat(to[1])});
      }
      // draw spline. pos[0] is end,  pos[1] is start
      ctx.beginPath();
      ctx.moveTo(pos[1].x, pos[1].y);
      for (var h=2; h<pos.length; h+=3) {
        ctx.bezierCurveTo(pos[h].x, pos[h].y, pos[h+1].x, pos[h+1].y, pos[h+2].x, pos[h+2].y);
      }
      ctx.lineTo(pos[0].x, pos[0].y);
      if (pos[1].y < pos[0].y) {
        ctx.lineWidth = 1;
      } else {
        ctx.lineWidth = 2;
      }
      ctx.strokeStyle = color;
      ctx.stroke();
      //draw arrow
      ctx.beginPath();
      ctx.moveTo(pos[0].x, pos[0].y);
      ctx.lineTo(pos[0].x-5, pos[0].y-10);
      ctx.lineTo(pos[0].x+5, pos[0].y-10);
      ctx.lineWidth = 1;
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // this is a vertex
      var vaddr = resp[i].trim().split(' ')[0].split('N')[1];
      var vpos = resp[i].slice(resp[i].indexOf('pos=')).split('"')[1].split(',');
      var vr = this.vertices[vaddr.trim()].rendered;
      if (vr !== undefined) {
        var left = fnum(vpos[0]) - (vr.offsetWidth/2);
        var top = fnum(gdata[3]) - (fnum(vpos[1]) + (vr.offsetHeight/2));
        vr.style.left = left + "px";
        vr.style.top = top + "px";
      }
    }
  }
  return;
};


function render_graph(x) {
  var obj;
  try {
    obj = JSON.parse(x.replace(/\\l/g,'\\n'));
  } catch (e) {
    console.log("Cannot parse JSON data");
  }
  // try {
    if (obj[0] === undefined) return false;
    if (obj[0].blocks === undefined) return false;
    var graph = new BBGraph();
    for (var bn = 0; bn < obj[0].blocks.length; bn++) {
      var bb = obj[0].blocks[bn];
      if (bb.length === 0) continue;
      var addr = bb.offset;
      var lines = bb.code.split('\n');
      var cnt = lines.length;
      var idump = "";
      for (var i = 0; i < cnt; i++) {
        var line = lines[i];
        if (line !== "") {
          // Prepare an instruction object
          var ins = {};
          ins.offset = line.split(' ')[0];
          if (ins.offset.indexOf("0x") !== 0) continue;
          ins.comment = "";
          ins.bytes = "";
          ins.type = "mov";
          var opcode_idx = line.indexOf(' ');
          var colon_idx = line.indexOf(';');
          if (colon_idx > 0) {
            ins.opcode = line.substring(opcode_idx,colon_idx).trim();
            ins.comment = line.substring(colon_idx + 1).trim();
          } else {
            ins.opcode = line.substring(opcode_idx).trim();
          }
          if (ins.opcode === "") continue;

          idump += html_for_instruction(ins);
        }
      }
      var dom = document.createElement('div');
      dom.id = "bb_" + addr;
      dom.className = "basicblock enyo-selectable ec_background ec_border";
      dom.innerHTML = idump;
      graph.addVertex(addr, cnt, dom);
      if (bb.fail > 0) {
        graph.addEdge(addr, bb.fail, "red");
        if (bb.jump > 0) {
          graph.addEdge(addr, bb.jump, "green");
        }
      } else if (bb.jump > 0) {
        graph.addEdge(addr, bb.jump, "blue");
      }
    }
    graph.render();
    return true;
  // } catch (e) {
  //   console.log("Error generating bb graph");
  // }
}

function render_instructions(instructions) {
  var outergbox = document.createElement('div');
  outergbox.id = 'outergbox';
  var flatcanvas = document.getElementById("flat_canvas");
  flatcanvas.innerHTML = "";
  var gbox = document.createElement('div');
  gbox.id = 'gbox';
  gbox.className = name;
  outergbox.appendChild(gbox);
  flatcanvas.appendChild(outergbox);

  var flatcanvas_rect = getOffsetRect(flatcanvas);
  var asm_lines = (r2.settings["asm.lines"]);
  var asm_offset = (r2.settings["asm.offset"]);

  var accumulated_heigth = flatcanvas_rect.top;
  var lines = [];
  var targets = {};
  var first_address = instructions[0].offset;
  var last_address = instructions[instructions.length - 1].offset;
  for (var i in instructions) {
    var ins = instructions[i];

    if ((ins.type == "jmp" || ins.type == "cjmp") && ins.jump !== undefined && ins.jump !== null) {
      var line = {};
      line.from = ins.offset;
      if (last_address < ins.jump) {
        line.to_end = false;
        line.to = last_address;
      } else if (first_address > ins.jump) {
        line.to_end = false;
        line.to = first_address;
      } else {
        line.to_end = true;
        line.to = ins.jump;
      }
      if (ins.type == "jmp") {
        line.color = r2ui.colors[".ec_jmp_line"];
        line.dashed = false;
      } else if (ins.type == "cjmp") {
        line.color = r2ui.colors[".ec_cjmp_line"];
        line.dashed = true;
      }
      line.to_start = true;
      lines[lines.length] = line;
      if (targets[line.to] === undefined) {
        targets[line.to] = 0;
      }
    }

    ins.offset = "0x" + ins.offset.toString(16);
    if (ins.comment === undefined || ins.comment === null) ins.comment = "";
    else {
      ins.comment = atob(ins.comment);
    }
    var dom = document.createElement('div');
    if (asm_lines) dom.className = "instructionbox enyo-selectable lines";
    else dom.className = "instructionbox";
    dom.style.top = accumulated_heigth + "px";
    dom.innerHTML = html_for_instruction(ins);

    gbox.appendChild(dom);
    var instruction_rect = getOffsetRect(dom);
    var instruction_heigth = instruction_rect.bottom - instruction_rect.top;
    accumulated_heigth += instruction_heigth;
  }


  if (asm_lines) {
    var canvas = document.createElement("canvas");
    canvas.width = 2500;
    canvas.height = accumulated_heigth + 100;
    canvas.id = "fcanvas";
    gbox.appendChild(canvas);
    var ctx = canvas.getContext("2d");
    if (!ctx.setLineDash) {
      // For browsers that dont support dashed lines
      ctx.setLineDash = function () {};
    }
    var num_targets = countProperties(targets);
    var num_assigned_paths = 0;
    var lines_width = 100;
    for (var l in lines) {
      var line = lines[l];
      var from = "0x" + line.from.toString(16);
      var to = "0x" + line.to.toString(16);

      if (targets[line.to] === 0) {
        // No path assigned for target, assigning a new one
        targets[line.to] = (num_targets - num_assigned_paths - 1)*(90/(num_targets+1));
        num_assigned_paths += 1;
      }
      var from_element = get_element_by_address(from);
      var to_element = get_element_by_address(to);

      if (from_element !== null && from_element !== undefined && to_element !== undefined && to_element !== null) {
        var x = targets[line.to];
        var from_rect = getOffsetRect(from_element);
        var y0 = (from_rect.top + from_rect.bottom) / 2;
        var to_rect = getOffsetRect(to_element);
        var y1 = (to_rect.top + to_rect.bottom) / 2;
        if (line.to == instructions[0].offset) {
          y1 = 0;
        }

        // main line
        ctx.beginPath();
        ctx.moveTo(x, y0);
        ctx.lineTo(x, y1);
        ctx.strokeStyle = line.color;
        if (line.dashed) ctx.setLineDash([2,3]);
        ctx.stroke();

        if (line.to_start) {
          // horizontal line at start
          ctx.beginPath();
          ctx.moveTo(x, y0);
          ctx.lineTo(lines_width - 5, y0);
          ctx.strokeStyle = line.color;
          if (line.dashed) ctx.setLineDash([2,3]);
          ctx.stroke();

          // circle
          ctx.beginPath();
          ctx.arc(lines_width - 5 - 2, y0, 2, 0, 2 * Math.PI, false);
          ctx.fillStyle = line.color;
          ctx.fill();
        }

        if (line.to_end) {
          // horizontal line at end
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(lines_width - 5, y1);
          ctx.strokeStyle = line.color;
          if (line.dashed) ctx.setLineDash([2,3]);
          ctx.stroke();

          // arrow
          ctx.beginPath();
          ctx.moveTo(lines_width - 5, y1);
          ctx.lineTo(lines_width - 10, y1-5);
          ctx.lineTo(lines_width - 10, y1+5);
          ctx.lineWidth = 1;
          ctx.fillStyle = line.color;
          ctx.fill();
        }
      }
    }
  }
  if (!asm_offset) {
    var elements = document.getElementsByClassName("insaddr");
    for (var j in elements) {
      if (elements[j].style) elements[j].style.display="none";
    }
  }
}

function getOffsetRect(elem) {
    var box = elem.getBoundingClientRect();

    var bar = document.getElementById("radareApp_mp_toolbar");
    var barrect = bar.getBoundingClientRect();

    var body = document.body;
    var docElem = document.documentElement;
    var scrollTop = window.pageYOffset || docElem.scrollTop || body.scrollTop;
    var clientTop = docElem.clientTop || body.clientTop || 0;
    var top  = box.top - barrect.bottom - 10; //+ scrollTop - clientTop;
    var bottom  = box.bottom - barrect.bottom - 10;//+  scrollTop - clientTop;

    return {top: Math.round(top), bottom: Math.round(bottom)};
}

function countProperties(obj) {
  var count = 0;
  for(var prop in obj) {
    if(obj.hasOwnProperty(prop)) {
      ++count;
    }
  }
  return count;
}

function toBoolean(str) {
  if (str === "true") return true;
  else if (str === "false") return false;
  else return undefined;
}

function html_for_instruction(ins) {
  var idump = '<div class="instruction enyo-selectable">';
  var address = ins.offset;
  var asm_flags = (r2.settings["asm.flags"]);
  var asm_bytes = (r2.settings["asm.bytes"]);
  var asm_xrefs = (r2.settings["asm.xrefs"]);
  var asm_cmtright = (r2.settings["asm.cmtright"]);

  if (asm_flags) {
    var flags;
    if (ins.flags !== undefined && ins.flags !== null) {
      flags = ins.flags.join(";");
    } else {
      flags = r2.get_flag_names(address_canonicalize(ins.offset)).join(";");
    }
    if (flags !== "" && flags !== undefined && flags !== null) idump += '<div class="ec_flag flags_' + address_canonicalize(ins.offset) + '">;-- ' + escapeHTML(flags) + ':</div> ';
  }
  if (ins.comment && !asm_cmtright) {
    idump += '<div class="comment ec_comment comment_' + address_canonicalize(ins.offset) + '">; ' + escapeHTML(ins.comment) + '</div>';
  }
  if (asm_xrefs) {
    if (ins.xrefs !== undefined && ins.xrefs !== null && ins.xrefs.length > 0) {
      var xrefs = "";
      for (var i in ins.xrefs) {
        var xref = ins.xrefs[i];
        var name = '';
        var offset = "0x"+xref.addr.toString(16);
        if (r2.get_flag_names(address_canonicalize(offset)).length > 0) name = ' (' + r2.get_flag_names(address_canonicalize(offset)).join(";") + ')';
        idump += '<div class="ec_flag xrefs">; ' + xref.type.toUpperCase() + ' XREF from ' +
        '<span class="offset addr addr_' + address_canonicalize(offset) + '">' + offset + '</span> ' +  name + '</div> ';
      }

    }
  }

  idump += '<span class="insaddr datainstruction ec_offset addr addr_' + address_canonicalize(ins.offset) + '">' + address + '</span> ';


  if (asm_bytes) {
    if (ins.bytes !== undefined && ins.bytes !== null && ins.bytes !== "") {
      var dorep = function(a) {
        if (a=="00") return '<span class="ec_b0x00">00</span>';
        if (a=="ff") return '<span class="ec_b0x00">ff</span>';
        if (a=="7f") return '<span class="ec_b0x00">7f</span>';
      };
      var bytes = ins.bytes.replace(new RegExp("(00)|(ff)|(7f)", "g"), dorep);
      idump += '<span class="bytes ec_other">' + bytes + '</span> ';
    }
  }
  if (ins.type !== undefined && ins.type !== null) {
    if (contains(math, ins.type)) ins.type = "math";
    if (contains(bin, ins.type)) ins.type = "bin";
    if (ins.type == "ill") ins.type = "invalid";
    if (ins.type == "null") ins.type = "invalid";
    if (ins.type == "undefined") ins.type = "invalid";
    if (ins.type == "ujmp") ins.type = "jmp";
    if (ins.type == "ucall") ins.type = "call";
    if (ins.type == "lea") ins.type = "mov";

    idump += '<div class="instructiondesc ec_' + ins.type + '">' + highlight_instruction(ins.opcode, true) + '</div> ';
  } else {
    idump += '<div class="instructiondesc">' + highlight_instruction(ins.opcode, true) + '</div> ';
  }
  if (ins.comment && asm_cmtright) {
    idump += '<span class="comment ec_comment comment_' + address_canonicalize(ins.offset) + '"> ; ' + escapeHTML(ins.comment) + '</span>';
  }
  idump += '</div>';
  return idump;
}

var math = ["add", "sub", "mul", "imul", "div", "idiv", "neg", "adc", "sbb", "inc", "dec", ".byte"];
var invalid = [".byte", "insb", "outsd"];// this is just as a workaround for the agj problem
var bin = ["xor", "and", "or", "not"];
var jmps = ["jmp"];
var cjmps = ["je", "jne", "jg", "jge", "jl", "jle", "ja", "jae", "jb", "jbe", "jo", "jno", "jc", "jnc", "js", "jns", "jz", "jnz"];
var calls = ["call"];
var movs = ["mov", "lea"];
var regs = ["EAX", "ECX", "EDX", "EBX", "ESP", "EBP", "ESI", "EDI", "EIP", "RAX", "RCX", "RDX", "RBX", "RSP", "RBP", "RSI", "RDI", "R0", "R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10", "R11", "R12", "R13", "R14", "R15", "RIP"];

var escapeHTML = (function () {
  'use strict';
  var chr = { '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' };
  return function (text) {
    return text.replace(/[\"&<>]/g, function (a) { return chr[a]; });
  };
}());

function highlight_instruction(line, instruction) {
  if (line === undefined) return "undefined";
  if (instruction === undefined) instruction = true;
  var ret = escapeHTML(line);

  // highlight registers and addresses
  var re = "(0x[0123456789abcdef]+)";
  // Map with register names as keys and HTML span representing the register as value
  var reps = {};
  if (instruction) {
    for (var i in regs) {
      // Loop all the registers
      var rep = '<span class="ec_reg">' + regs[i] +'</span>';
      reps[regs[i]] = rep;
      rep = '<span class="ec_reg">' + regs[i].toLowerCase() + '</span>';
      reps[regs[i].toLowerCase()] = rep;
    }
    for (i in reps) {
      // Complete regexp with registers
      re += "|(" + i + ")";
    }
  }
  function dorep(a) {
    // If address found
    if (a.substr(0, 2) == "0x") {
      // Look for imports or functions
      var syms = r2.get_flag_names(address_canonicalize(a));
      for (var i in syms) {
        if (syms[i].indexOf("sym.imp.")) {
          return "<span class='ec_offset addr addr_" + address_canonicalize(a) + "'>" + syms[i] + "</span>";
        }
        if (syms[i].indexOf("fcn.")) {
          return "<span class='ec_offset addr addr_" + address_canonicalize(a) + "'>" + syms[i] + "</span>";
        }
      }
      // Is it data address or code address
      var cl = get_data_type(a);
      if (cl === "") {
        // Just an hex value, not an address
        return "<span class='ec_num'>" + a + "</span>";
      } else if (cl === "datainstruction") {
        // An address representing data (memory) or code (instruction)
        return "<span class='ec_offset addr addr_" + address_canonicalize(a) + "'>" + a + "</span>";
      } else if (cl === "datamemory") {
        return "<span class='ec_dataoffset addr addr_" + address_canonicalize(a) + "'>" + a + "</span>";
      }
    } else {
      // Not an hex value, so a register
      return reps[a];
    }
  }
  ret = ret.replace(new RegExp(re, "g"), dorep);

  // highlight opcode
  if (instruction) {
    var j = 0;
    for (j = 0; j < ret.length; j++) {
      if (ret[j] == ' ' || ret[j] == '\t') {
        break;
      }
    }
    var op = ret.substr(0, j);

    var rest = ret.substr(j);

    // WORKAROUND until agj returns structured data:
    var klass = "";
    if (contains(math, op)) klass = "ec_math";
    if (contains(bin, op)) klass = "ec_bin";
    if (contains(invalid, op)) klass = "invalid";
    if (contains(jmps, op)) klass = "ec_jmp";
    if (contains(cjmps, op)) klass = "ec_cjmp";
    if (contains(calls, op)) klass = "ec_call";
    if (contains(movs, op)) klass = "ec_mov";
    if (op == "push") klass = "ec_push";
    if (op == "pop") klass = "ec_pop";
    if (op == "nop") klass = "ec_nop";
    if (op == "ret") klass = "ec_ret";
    if (op == "cmp") klass = "ec_cmp";
    // WORKAROUND

    ret = '<span class="op ' + klass + '">' + op + '</span>' + rest;
  }
  return ret;
}

function hex2(a) {
  if (a === undefined) return "__";
  var ret = a.toString(16);
  if (ret.length == 1) return "0" + ret;
  return ret;
}

function hex(a) {
  if (a === undefined) {
    return "";
  } else {
    if (a < 0) a += 0x100000000;
    return "0x"+a.toString(16);
  }
}

function get_data_type(v, more) {
  var a = r2.get_address_type(v);
  if (a === "") return "";
  else {
    if (more !== undefined) {
      return "data" + a + " addr addr_" + v;
    } else {
      return "data" + a;
    }
  }
}

function fnum(a) {
  return parseInt(a, 10);
}

function get_address_from_class(t, type) {
  if (type === undefined) type = "addr";
  var l = t.className.split(" ").filter(function(x) { return x.substr(0,5) == type+"_"; });
  if (l.length != 1) return undefined;
  return l[0].split("_")[1].split(" ")[0];
}

function rehighlight_iaddress(address) {
  var elements = document.getElementsByClassName("autohighlighti");
  for (var i = 0; i < elements.length; i++) {
    removeClass("autohighlighti", elements[i]);
  }
  elements = document.getElementsByClassName("addr_" + address);
  for (var j = 0; j < elements.length; j++) {
    addClass("autohighlighti", elements[j]);
  }
}

function get_element_by_address(address) {
  var elements = document.getElementsByClassName("insaddr addr_" + address);
  if (elements.length === 1) return elements[0];
  else return null;
}

Element.prototype.documentOffsetTop = function () {
    return this.offsetTop + ( this.offsetParent ? this.offsetParent.documentOffsetTop() : 0 );
};

function scroll_to_address(address) {
  var elements = document.getElementsByClassName("insaddr addr_" + address);
  if (elements.length == 1) {
    var top = elements[0].documentOffsetTop() - ( window.innerHeight / 2 );
    top = Math.max(0,top);
    r2ui._dis.scrollTo(0,top);
  }
}

function scroll_to_element(element) {
  var top = element.documentOffsetTop() - ( window.innerHeight / 2 );
  top = Math.max(0,top);
  r2ui._dis.scrollTo(0,top);
}

function addClass( classname, element ) {
    var cn = element.className;
    if( cn.indexOf( classname ) != -1 ) {
      return;
    }
    if( cn !== '' ) {
      classname = ' '+classname;
    }
    element.className = cn+classname;
}

function removeClass( classname, element ) {
    var cn = element.className;
    var rxp = new RegExp( "\\s?\\b"+classname+"\\b", "g" );
    cn = cn.replace( rxp, '' );
    element.className = cn;
}

function address_canonicalize(s) {
  s = s.substr(2);
  while (s.substr(0,1) == '0') s = s.substr(1);
  s = "0x" + s;
  s = s.toLowerCase();
  return s;
}

function contains(a, obj) {
    for (var i = 0; i < a.length; i++) {
        if (a[i] === obj) {
            return true;
        }
    }
    return false;
}

function handleInputTextChange() {
  r2ui._dis.handleInputTextChange();
}

// Cookies

function createCookie(name,value,days) {
    if (days) {
        var date = new Date();
        date.setTime(date.getTime()+(days*24*60*60*1000));
        var expires = "; expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
}

function eraseCookie(name) {
    createCookie(name,"",-1);
}
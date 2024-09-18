"use strict";function get_center(c){return{x:c.x.baseVal.value+c.width.baseVal.value/2,y:c.y.baseVal.value+c.height.baseVal.value/2};}
function calc_dist(c,g){return Math.pow(Math.pow(g.cx.baseVal.value-c.x,2)
+Math.pow(g.cy.baseVal.value-c.y,2),0.5);}
function calc_true_distance_shift(center,g1,g2,d100){var c=get_center(center);d100=d100||100;var r100=calc_dist(c,g1),r200=calc_dist(c,g2),d200=200;var a=7-r100/r200/0.13;var b=7*d200+6*d100+350-2*r100/r200/0.13*d100;var c=6*d100*d200+350*d200-r100/r200/0.13*d100*d100;var k=(-Math.pow(Math.pow(b,2)-4*a*c,0.5)-b)/2/a;return k;}
function calc_nd(od,n,m,k){return((n+k)/(m+k)*od)*(6+(350+k)/(m+k))*0.13;}
function calc_vector(cx,cy,x,y,n,m,k){var od=Math.pow(Math.pow(cx-x,2)+Math.pow(cy-y,2),0.5);var nd=calc_nd(od,n,m,k);var res={x:(cx-x)*nd/od+x,y:(cy-y)*nd/od+y};if(!localStorage.gunsight_adjustment||localStorage.gunsight_adjustment=='1'){if(Math.abs(res.x-x)<2.5&&Math.abs(res.y-y)<10)res.x=x;if(Math.abs(res.y-y)<2.5&&Math.abs(res.x-x)<10)res.y=y;}
return res;}
function adjust_gunsight(m){var center=document.querySelector('[data-es="gunsight0"]')
if(!center)return;var c=get_center(center);var true_distance_shift=parseFloat(center.dataset.esTrueDistanceShift);document.querySelectorAll('.es-gun').forEach(sight=>{var cx=parseInt(sight.dataset.esX),cy=parseInt(sight.dataset.esY);var position=calc_vector(cx,cy,c.x,c.y,200,m,true_distance_shift);sight.cx.baseVal.value=position.x;sight.cy.baseVal.value=position.y;});document.querySelectorAll('.es-target').forEach(target=>{var box=target.getBBox();var scale=calc_nd(6,200,m+true_distance_shift,true_distance_shift);target.transform.baseVal.getItem(0).setTranslate(-box.width/2*scale+c.x,-box.height/2*scale+c.y);target.transform.baseVal.getItem(1).setScale(scale,scale);});}
function fire_range_change(ev){adjust_gunsight(parseInt(ev.target.value));$t.id('fire_range_number').innerHTML=`${ev.target.value}m`;}
function es_mouseover(ev){document.querySelectorAll(`[data-es="${ev.target.dataset.es}"]`).forEach(el=>el.dataset.hover=1);}
function es_mouseout(ev){document.querySelectorAll(`[data-es="${ev.target.dataset.es}"]`).forEach(el=>el.dataset.hover=0);}
function es_click(ev){document.querySelectorAll(`[data-es="${ev.target.dataset.es}"]`).forEach(el=>el.dataset.sel=el.dataset.sel==="1"?0:1);if(ev.type=='touchend')es_mouseout(ev);ev.stopPropagation();}
function es_deselect_all(ev){document.querySelectorAll('[data-sel="1"]').forEach(el=>el.dataset.sel=0);ev.stopPropagation();}
function add_es_listeners(b){$t.bind(b,'mouseenter',es_mouseover);$t.bind(b,'mouseleave',es_mouseout);$t.bind(b,['click','touchend'],es_click);}
function ship_info(info,core){if(info===undefined)return '';var core_info='',fighter_info='';if(core!==undefined)core_info=`<br/><span><i>Sensors Size Class</i>: ${core[5]};</span><span><i>Fuel Tank, t</i>: ${2**core[6]}</span>`;if(info[9]!==undefined)fighter_info=`<br/><span>Fighter Addendum.</span><span><i>Armor</i>: ${info[9]};</span><span><i>Shields, MJ</i>: ${info[10]}</span><span>Shield Generator is in internal 1</span>`;return `<div class="ship-info"><span><i>Manufacturer</i>: ${info[8]};</span><span><i>Pad</i>: ${info[0]};</span><span><i>Dimensions, m</i>: L ${info[1]} × W ${info[2]} × H ${info[3]};</span><span><i>Seats</i>: ${info[4]};</span><span><i>Hull Mass, t</i>: ${info[5]};</span><span><i>Mass Lock Factor</i>: ${info[6]};</span><span><i>Armor Hardness</i>: ${info[7]}</span>${core_info}${fighter_info}</div>`;}
function update_sheet(svg_content,ship_descr){
  var hard_points=$t.id('hard_points');
  $t.empty(hard_points);
  ship_descr.hard_points.forEach((hp,i)=>{
    var b=$t.element('span',{
      class:'es-button es-hard-point-button','data-size':hp,'data-es':`hard_point${i+1}`
    },$t.element('div',{},hard_points),`${hp} ${i+1}`);
    add_es_listeners(b);
  });
  var utility=$t.id('utility');
  $t.empty(utility);
  for(var i=0;i<ship_descr.utilities;++i){
    var b=$t.element('span',{class:'es-button es-utility-button','data-size':'U','data-es':`utility${i+1}`
                            },$t.element('div',{},utility),(i+1));
    add_es_listeners(b);
  }
  var other=$t.id('other');
  $t.empty(other);
  ['canopy','cargo hatch','fighter bay'].forEach(i=>{
    var b=$t.element('span',{class:'es-button es-other-button','data-es':`other${i}`},other,i);
    if(ship_descr.missing_modules.indexOf(i)==-1)add_es_listeners(b);
    else b.setAttribute('disabled','1');
                                                    });
  ['landing gear','thrusters','heat vents'].forEach(i=>{
    var b=$t.element('span',{class:'es-button es-other-button','data-es':`misc${i}`},other,i);
    if(ship_descr.missing_modules.indexOf(i)==-1)add_es_listeners(b);
    else b.setAttribute('disabled','1');
                                                        });
  if(ship_descr.missing_modules.indexOf('landing gear')==-1){
    var b=$t.element('span',{class:'es-button es-internal-button','data-es':`internalentrance`},other,'entrance');
    add_es_listeners(b);
                                                            }
  var internal=$t.id('internal');
  $t.empty(internal);
  if(ship_descr.internal){
    ['PP','drive','FSD','life support','distributor'].forEach((i,j)=>{
      if(ship_descr.core[j]===0)return;
      add_es_listeners($t.element('span',{class:'es-button es-internal-button','data-es':`internal${i}`},internal,`${ship_descr.core[j]} ${i}`));
                                                                      });
    ship_descr.internal.forEach((i,j)=>{
      add_es_listeners($t.element('span',{class:`es-button es-internal-button es-internal-type${Math.floor(i/10)}`,'data-es':`internal${j+1}`},internal,i%10));
    });
  }
  $t.id('ship_name').innerHTML=ship_descr.name;
  document.title=`${ship_descr.name} - Elite Dangerous Ship Anatomy`;
  $t.id('ingame_description').innerHTML='<div>'+ship_descr.ingame_description+'</div>'+ship_info(ship_descr.info,ship_descr.core);
  var svg_holder=$t.id('svg');
  $t.empty(svg_holder);
  var dom=(new DOMParser()).parseFromString(svg_content,"image/svg+xml");
  var svg=dom.documentElement;svg.style.stroke='var(--outline)';
  $t.bind(svg,'click',es_deselect_all);
  svg_holder.appendChild(svg);
  svg_holder.querySelectorAll("desc").forEach(el=>{
    var t=JSON.parse(el.innerHTML);
    var node=el.parentNode;
    node.dataset.es=t.type+t.i;
    if(t.type=='gunsight'){node.style.stroke='none';return;}
    if(t.cl)node.classList.add(`es-${t.cl}`);
    else node.classList.add('es-place',`es-${t.type}-place`);
    add_es_listeners(node);
    if(t.cl=='gun'){
      node.dataset.esX=node.cx.baseVal.value;
      node.dataset.esY=node.cy.baseVal.value;
      node.setAttribute('stroke-width',0);
                    }
  });
  $t.id('ship_selector').style.display='inline-block';
  var c=document.querySelector('[data-es="gunsight0"]');
  var g1=document.querySelector(`[data-es="gunsight${ship_descr.calibration_gun}"]`);
  var g2=document.querySelector(`circle[data-es="hard_point${ship_descr.calibration_gun}"]`);
  if(!(c&&g1&&g2))return;
  c.dataset.esTrueDistanceShift=calc_true_distance_shift(c,g1,g2,ship_descr.calibration_distance);
  g1.style.display='none';
  var neutral_distance=ship_descr.neutral_distance||500;$t.id('fire_range').value=neutral_distance;
  adjust_gunsight(neutral_distance);
  $t.id('fire_range_number').innerHTML=`${neutral_distance}m`;
  update_target_ship(localStorage.gunsight_target);
  // my edits
  var modDicts = {};
  exampleFetch();
  async function exampleFetch() {
          const response = await fetch('https://dl.dropbox.com/scl/fi/f793wjwvjvg99ojv3hc6m/ShipList.plist?rlkey=3i1crytk4l1g62tfqm2pcqesb&st=esdtqft6&dl=0');
          var sysString = await response.text();
          if (response.ok) {
            console.log('Promise resolved and HTTP status is successful');
            // ...do something with the response
          } else {
            console.error('Promise resolved but HTTP status failed');
          }
            modDicts = PlistParser.parse(sysString);
            //const modules = Object.keys(modDicts);
            var systems = modDicts[ship_descr.name];
            console.log(systems);
            var dataAr = [];
            for (const [key, value] of Object.entries(systems)) {
                var data = {};
                data.system = key;
                for (const [stationKey, priceValue] of Object.entries(value)) {
                        data.station=stationKey;
                        data.price=priceValue;
                }
                dataAr.push(data);
            }
            //console.log(dataAr);
            var dt = dynamicTable.config('data-table',
                                         ['system','station','price'],
                                         ['System','Station','Price'], //set to null for field names instead of custom header names
                                               'There are no items to list...');
            dt.load(dataAr);
        }        
        var dynamicTable = (function() {
            
            var _tableId, _table,
                _fields, _headers,
                _defaultText;
            
            /** Builds the row with columns from the specified names.
             *  If the item parameter is specified, the memebers of the names array will be used as property names of the item; otherwise they will be directly parsed as text.
             */
            function _buildRowColumns(names, item) {
                var row = '<tr>';
                if (names && names.length > 0)
                {
                    $.each(names, function(index, name) {
                        var c = item ? item[name+''] : name;
                        var curow = '<td>' + c + '</td>';
                        if (curow.includes('System')){
                            row = '<tr bgcolor="lightgray">';
                        }
                        if (curow.includes('Aetolians')) {
                            curow = '<td bgcolor="palegreen">' + c + '</td>';
                        }
                        if (curow.includes(':')) {
                            curow = '<td bgcolor="black">' + c + '</td>';
                        }
                        if (curow.includes('War')||curow.includes('Election')) {
                            curow = '<td bgcolor="red">' + c + '</td>';
                        }
                        if (curow.includes('Retreat')) {
                            curow = '<td bgcolor="pink">' + c + '</td>';
                        }
                        if (curow.includes('Boom')) {
                            curow = '<td bgcolor="palegreen">' + c + '</td>';
                        }
                        if (curow.includes('Expansion')) {
                            curow = '<td bgcolor="lightblue">' + c + '</td>';
                        }
                        row += curow;//'<td>' + c + '</td>';

                    });
                }
                row += '</tr>';
                return row;
            }
            
            /** Builds and sets the headers of the table. */
            function _setHeaders() {
                // if no headers specified, we will use the fields as headers.
                _headers = (_headers == null || _headers.length < 1) ? _fields : _headers;
                var h = _buildRowColumns(_headers);
                if (_table.children('thead').length < 1) _table.prepend('<thead></thead>');
                _table.children('thead').html(h);
            }
            
            function _setNoItemsInfo() {
                if (_table.length < 1) return; //not configured.
                var colspan = _headers != null && _headers.length > 0 ?
                    'colspan="' + _headers.length + '"' : '';
                var content = '<tr class="no-items"><td ' + colspan + ' style="text-align:center">' +
                    _defaultText + '</td></tr>';
                if (_table.children('tbody').length > 0)
                    _table.children('tbody').html(content);
                else _table.append('<tbody>' + content + '</tbody>');
            }
            
            function _removeNoItemsInfo() {
                var c = _table.children('tbody').children('tr');
                if (c.length == 1 && c.hasClass('no-items')) _table.children('tbody').empty();
            }
            
            return {
                /** Configres the dynamic table. */
                config: function(tableId, fields, headers, defaultText) {
                    _tableId = tableId;
                    _table = $('#' + tableId);
                    _fields = fields || null;
                    _headers = headers || null;
                    _defaultText = defaultText || 'No items to list...';
                    _setHeaders();
                    _setNoItemsInfo();
                    return this;
                },
                /** Loads the specified data to the table body. */
                load: function(data, append) {
                    if (_table.length < 1) return; //not configured.
                    _setHeaders();
                    _removeNoItemsInfo();
                    if (data && data.length > 0) {
                        var rows = '';
                        $.each(data, function(index, item) {
                            rows += _buildRowColumns(_fields, item);
                        });
                        var mthd = append ? 'append' : 'html';
                        _table.children('tbody')[mthd](rows);
                    }
                    else {
                        _setNoItemsInfo();
                    }
                    return this;
                },
                /** Clears the table body. */
                clear: function() {
                    _setNoItemsInfo();
                    return this;
                }
            };
        }());
  $t.id('where').innerHTML='Go here to find ' + ship_descr.name;
  
  // end my edits
}

function load_file(name,callback){fetch(name,{cache:'default'}).then(response=>response.text()).then(res=>callback(res));return;}
function update_target_ship(name){var svg=$t.id('svg').querySelector('svg');if(!svg||svg.dataset.target===name)return;svg.dataset.target=name;if(name===''||name===undefined)svg.querySelectorAll('.es-target').forEach(target=>target.remove());else load_file(`target-${name}.svg`,res=>{svg.querySelectorAll('.es-target').forEach(target=>target.remove());var target=(new DOMParser()).parseFromString(res,"image/svg+xml").documentElement.querySelector('path');target.classList.add('es-target');svg.insertBefore(target,svg.firstChild);target.transform.baseVal.appendItem(svg.createSVGTransform());target.transform.baseVal.appendItem(svg.createSVGTransform());adjust_gunsight(parseInt($t.id('fire_range').value));setTimeout(function(){target.style.transition='0.3s'},600);});}
function show_ship(ship_descr){load_file(`${ship_descr.link}.svg`,res=>{$t.remove($t.id('loading_text'));$t.id('main_section').style.display='block';update_sheet(res,ship_descr);});}
function apply_options(){if(localStorage.color_theme!==undefined){var theme={white:{outline:'#000',backcolor:'#fff',a:'gray'},blueprint:{outline:'#fff',backcolor:'radial-gradient(#0061af, #003988) #0061af',a:'lightblue'},dark:{outline:'#fff',backcolor:'#444',a:'#aaa'},}[localStorage.color_theme];for(var c in theme)document.documentElement.style.setProperty(`--${c}`,theme[c]);}
if(localStorage.show_hooks!==undefined){document.documentElement.style.setProperty('--show-hooks',localStorage.show_hooks>=1?1:0);document.documentElement.style.setProperty('--show-all-hooks',localStorage.show_hooks==='2'?1:0);}
update_target_ship(localStorage.gunsight_target);adjust_gunsight(parseInt($t.id('fire_range').value));}
function option_changed(ev){localStorage[ev.target.id]=ev.target.selectedOptions[0].value;apply_options();}
function initialize(container){var menu_ship_list=$t.id('menu_ship_list'),menu_fighter_list=$t.id('menu_fighter_list');ship_list.forEach(ship_descr=>{$t.element('a',{class:'ship-link',href:`?s=${ship_descr.link}`},menu_ship_list,ship_descr.name);});fighter_list.forEach(ship_descr=>{$t.element('a',{class:'ship-link',href:`?s=${ship_descr.link}`},menu_fighter_list,ship_descr.name);});var params=$t.get_url_params();if(params.s){var ship_descr=ship_list.concat(fighter_list).find(descr=>descr.link==params.s);if(ship_descr)show_ship(ship_descr);else window.location.search='';}
else{$t.id('ship_selector').style.display='inline-block';$t.id('ship_menu').style.display='block';$t.remove($t.id('loading_text'));}
$t.bind($t.id('fire_range'),['change','input'],fire_range_change);$t.bind(document.body,'click',ev=>{if(ev.target.className=='menu-holder')ev.target.style.display='none';if(ev.target.className=='menu-content')ev.stopPropagation();});$t.bind($t.id('ship_selector'),'click',ev=>$t.id('ship_menu').style.display='block');$t.bind($t.id('options'),['click'],ev=>$t.id('options_menu').style.display='block');$t.bind($t.id('sheetinfo'),['click'],ev=>$t.id('sheetinfo_menu').style.display='block');['color_theme','show_hooks','gunsight_adjustment','gunsight_target'].forEach(i=>{if(localStorage[i]!==undefined)$t.id(i).value=localStorage[i];$t.bind($t.id(i),['change'],option_changed);});apply_options();}

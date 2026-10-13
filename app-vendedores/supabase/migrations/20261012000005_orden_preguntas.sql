-- =====================================================================
-- Módulo VDH · Banco de preguntas del desafío semanal
-- Sacadas de: "Explicación de telas y su uso en artículos",
--             "Molderías VDH" y "Manual Retail 2025".
-- Dificultad: 1 = básico, 2 = intermedio, 3 = detalle fino.
-- Todo editable desde No Compra. Si cambia un manual (ej. códigos de
-- cuotas), hay que actualizar las preguntas con esa fuente.
-- =====================================================================

insert into orden_preguntas (tema, dificultad, fuente, pregunta, opciones, correcta, explicacion) values

-- ------------------------------ TELAS ------------------------------
('tela', 1, 'Telas y su uso', '¿Qué composición tiene el Jersey 40/1?',
 array['100% algodón', '50% algodón y 50% poliéster', '80% algodón y 20% poliéster', '98% algodón y 2% elastano'], 2,
 'El Jersey 40/1 es 50% algodón y 50% poliéster. Lo usamos en la mayoría de las remeras de moldería regular, como la Clásica O.'),

('tela', 1, 'Telas y su uso', '¿En qué remeras usamos sobre todo el Jersey 24/1?',
 array['En las regulares, como la Clásica O', 'En la mayoría de las oversize, como la Overs', 'Solo en las chombas', 'En las camisas'], 2,
 'El Jersey 24/1 (100% algodón) es pesado y suave. Lo usamos en la mayoría de las remeras oversize, por ejemplo la Overs.'),

('tela', 2, 'Telas y su uso', 'De estos jerseys, ¿cuál es el más pesado?',
 array['Jersey 40/1', 'Jersey 24/1', 'Jersey 20/1', 'Pesan todos igual'], 3,
 'El 20/1 es más pesado que el 24/1, y el 24/1 más que el 40/1. El 20/1 lo usamos en remeras over, extra over, Hi y Boxy.'),

('tela', 1, 'Telas y su uso', 'Un cliente compra una remera de Jersey 24/1. ¿Qué le recomendás para lavarla?',
 array['Agua caliente para que no encoja', 'Agua fría, separando colores y colgarla a la sombra', 'Secarropas en temperatura alta', 'Secarla al sol para que no quede humedad'], 2,
 'Es 100% algodón: muy linda por ser natural pero menos estable que las sintéticas. Siempre agua fría, colores separados y secado a la sombra.'),

('tela', 2, 'Telas y su uso', '¿Por qué el Jersey 40/1 casi no se arruga y seca rápido?',
 array['Por su porcentaje de poliéster', 'Porque es 100% algodón', 'Porque tiene elastano', 'Porque es más pesado'], 1,
 'El poliéster (50% en el 40/1) hace que la tela no tienda a arrugarse y que seque rápido.'),

('tela', 2, 'Telas y su uso', 'La frisa liviana esmerilada tiene un "pelito" suave. ¿Qué es?',
 array['Una falla de fabricación', 'El acabado esmerilado que le da la suavidad', 'Pelusa que se va con el primer lavado', 'Un forro que se cose aparte'], 2,
 'Ese "pelito" es el acabado esmerilado, y es lo que le da la suavidad al tacto. Es la tela de la mayoría de buzos y pantalones de invierno, como el Colston Relax.'),

('tela', 2, 'Telas y su uso', '¿Qué composición tiene la frisa liviana esmerilada?',
 array['50% algodón y 50% poliéster', '100% algodón', '80% algodón y 20% poliéster', '100% poliéster'], 3,
 'Es 80% algodón y 20% poliéster. La frisa algodón poliéster, en cambio, es 50 y 50.'),

('tela', 3, 'Telas y su uso', '¿Cómo distinguís a simple vista la frisa algodón poliéster de la frisa liviana esmerilada?',
 array['La algodón poliéster no tiene el "pelito" y es más pesada', 'La algodón poliéster es brillante', 'La esmerilada es más pesada', 'No se pueden distinguir'], 1,
 'La frisa algodón poliéster es más pesada y no tiene el "pelito" del esmerilado. La usamos en algunos buzos y pantalones como el Nesta Relax o el Ader Over.'),

('tela', 1, 'Telas y su uso', '¿Cómo se lavan los buzos y pantalones de frisa?',
 array['Del derecho y con agua tibia', 'Del revés, con agua fría y secado a la sombra', 'Solo en tintorería', 'Con suavizante y al sol'], 2,
 'Para todas las frisas: siempre del revés, agua fría y secar a la sombra.'),

('tela', 2, 'Telas y su uso', '¿En qué prendas usamos el Rústico Pesado?',
 array['En la mayoría de los buzos y pantalones, como el Journey Relax', 'En las camisas', 'En las camperas de jean', 'En las chombas'], 1,
 'El Rústico Pesado (50% algodón, 50% poliéster) no tiende a arrugarse. Lo usamos en la mayoría de los buzos y pantalones, por ejemplo el Journey Relax (buzo y pantalón).'),

('tela', 1, 'Telas y su uso', '¿De qué tela son la mayoría de nuestras chombas, como la Aries?',
 array['Piqué 30/1, 100% algodón', 'Jersey 40/1', 'Frisa esmerilada', 'Poplin con elastano'], 1,
 'La mayoría son de Piqué 30/1: liviano, respirable y 100% algodón.'),

('tela', 3, 'Telas y su uso', 'La chomba Tari no es de piqué. ¿De qué tela es?',
 array['Gabardina', 'Jersey 24/1, la misma de las remeras', 'Lino', 'Rústico'], 2,
 'Algunas chombas se hacen en Jersey 24/1, la misma tela de remería. Llevan el mismo cuidado: agua fría, colores separados y secado a la sombra.'),

('tela', 2, 'Telas y su uso', '¿Qué tela usamos en la mayoría de las camisas manga larga, como la Sigma o la Venecia?',
 array['Lino 100%', 'Poplin con elastano (98% algodón y 2% elastano)', 'Jersey 24/1', 'Gabardina rígida'], 2,
 'El poplin con elastano es liviano, elastizado y respirable gracias a su alto porcentaje de algodón.'),

('tela', 2, 'Telas y su uso', '¿Qué composición tiene la gabardina con elastano de pantalones como el New Dalis?',
 array['100% algodón', '97% algodón y 3% elastano', '50% algodón y 50% poliéster', '100% poliéster'], 2,
 'Es 97% algodón y 3% elastano: liviana, elastizada, noble y resistente.'),

('tela', 1, 'Telas y su uso', 'La mayoría de nuestros jeans son…',
 array['Rígidos, 100% algodón', 'Elastizados, 98% algodón y 2% elastano', 'De poliéster', 'De gabardina'], 2,
 'La gran mayoría son elastizados (98% algodón y 2% elastano) y algunos pocos de denim rígido 100% algodón. Todos son durables y resistentes.'),

('tela', 1, 'Telas y su uso', '¿Cómo recomendás lavar un jean?',
 array['Del revés, con agua fría y secado a la sombra', 'Con lavandina para que no se destiña', 'Del derecho y al sol', 'Con agua caliente'], 1,
 'Igual que las frisas: del revés, agua fría y secar a la sombra. Las camperas de jean llevan el mismo cuidado.'),

('tela', 2, 'Telas y su uso', '¿De qué tela suelen ser las camperas de jean, como la Essence 90s?',
 array['Denim elastizado', 'Denim rígido 100% algodón', 'Frisa', 'Poliéster'], 2,
 'Generalmente usamos denim rígido 100% algodón: muy durable y resistente.'),

('tela', 3, 'Telas y su uso', 'Las camperas de telas de fantasía, como la Tolhuin CP o la Giovani, ¿qué composición suelen tener?',
 array['100% algodón', '100% poliéster', '50% algodón y 50% poliéster', '98% algodón y 2% elastano'], 2,
 'Suelen ser 100% poliéster: durables en el tiempo, y algunas más resistentes al viento.'),

('tela', 2, 'Telas y su uso', '¿Qué tienen en común las telas tipo "lino" que usamos?',
 array['Son pesadas y abrigadas', 'Son livianas y frescas; algunas tienen elastano', 'Son 100% poliéster', 'Se pueden lavar con agua caliente'], 2,
 'Son livianas y frescas. Algunas tienen elastano y estiran un poco más que las 100% algodón. Se lavan con agua fría y se secan a la sombra.'),

-- ---------------------------- MOLDERÍAS ----------------------------
('molderia', 1, 'Molderías VDH', '¿Cómo es el calce de una remera regular, como la Clásica O o la Daily?',
 array['Muy suelta y con hombro caído', 'Regular, ligeramente entallada', 'Corta y ancha', 'Extra oversize'], 2,
 'La regular tiene un calce regular, ligeramente entallado.'),

('molderia', 1, 'Molderías VDH', '¿Qué caracteriza a una remera oversize, como la Overs?',
 array['Es entallada', 'Es suelta, más ancha que la regular y con los hombros ligeramente caídos', 'Es más corta que la Boxy', 'Tiene el cuello más alto'], 2,
 'La oversize es suelta, más ancha que la regular y con los hombros ligeramente caídos.'),

('molderia', 2, 'Molderías VDH', 'La remera Oversize "Hi", como la Zen Hi, comparada con la oversize clásica…',
 array['Es un poco más corta y tiene el cuello más alto', 'Es más larga y entallada', 'Es igual pero de otra tela', 'Es más ancha de hombros'], 1,
 'La Hi tiene calce oversize, pero es un poco más corta y con el cuello más alto.'),

('molderia', 2, 'Molderías VDH', '¿Qué moldería de remera es la más corta?',
 array['Oversize', 'Oversize Hi', 'Boxy', 'X-Over'], 3,
 'La Boxy (por ejemplo, la Nois Boxy) tiene calce oversize pero es más corta que la Oversize y que la Hi.'),

('molderia', 2, 'Molderías VDH', '¿Qué es la moldería X-Over?',
 array['Una regular con cuello alto', 'Un calce extra oversize, más amplio que la oversize', 'Una remera corta y entallada', 'Una camisa'], 2,
 'La X-Over es extra oversize, más amplia que la oversize. Ejemplos: Eminem X-Over en remera, Vibe X-Over en buzo.'),

('molderia', 3, 'Molderías VDH', '¿Qué es la terminación "collareta cortada"?',
 array['Un cuello con botones', 'Una tira de tela en cuello y mangas que después se corta', 'Un estampado en el cuello', 'Un cuello alto tipo Hi'], 2,
 'Es una tira de tela que se aplica en el cuello y las mangas y después se corta. Es una variación de la remera regular.'),

('molderia', 2, 'Molderías VDH', 'En el lavado "Maltinto" o "Fade Out" hecho del revés, ¿qué queda del lado de afuera?',
 array['La parte más oscura', 'El lado más claro', 'Un estampado', 'Nada cambia'], 2,
 'Del derecho, la parte oscura del lavado queda afuera. Del revés, queda afuera el lado más claro. Ejemplos: Inky e Ink Over.'),

('molderia', 3, 'Molderías VDH', '¿Qué se ve en una remera con lavado "Acid", como la Seventy Boxy?',
 array['Un desgaste en el color', 'Roturas', 'Un brillo metalizado', 'Un estampado en relieve'], 1,
 'El Acid deja un desgaste en el color.'),

('molderia', 1, 'Molderías VDH', 'Un cliente compra una remera con lavado Maltinto o Acid. ¿Qué le avisás?',
 array['Que la puede lavar con todo junto', 'Que cada prenda es única, que la lave con agua fría y separada de los oscuros, porque al principio puede soltar color', 'Que no la puede lavar nunca', 'Que va a encoger un talle'], 2,
 'Son teñidos artesanales: ninguna prenda queda igual a otra. Agua fría, oscuros separados (los primeros lavados pueden soltar color) y secado a la sombra.'),

('molderia', 2, 'Molderías VDH', '¿Cómo es la moldería Relax de buzo, como el Journey Relax?',
 array['Igual a la regular', 'Intermedia: más corta que la oversize pero bastante más amplia que la regular', 'Más larga que la oversize', 'Entallada'], 2,
 'La Relax es intermedia entre la regular y la oversize: más corta que la oversize y bastante más amplia que la regular.'),

('molderia', 1, 'Molderías VDH', '¿Cómo es el jean de corte "Denim" (regular), como el Denim Blacky?',
 array['Corte clásico, piernas rectas, largo debajo del tobillo y tela elastizada', 'Piernas anchas y tela rígida', 'Holgado en caderas y piernas ajustadas', 'Piernas anchas tipo baggy'], 1,
 'Es el corte clásico: piernas rectas, largo debajo del tobillo y confeccionado con telas elastizadas.'),

('molderia', 2, 'Molderías VDH', '¿Cómo es el jean Relax, como el Rucci Relax?',
 array['Holgado en caderas, piernas ajustadas y largo hasta el tobillo', 'Piernas anchas y rígido', 'Igual al 90''s', 'Muy ajustado en todo'], 1,
 'El Relax es ligeramente holgado en caderas, con piernas ajustadas y largo hasta el tobillo. Tela elastizada.'),

('molderia', 2, 'Molderías VDH', '¿Cómo es el jean 90''s, como el Kelian 90s?',
 array['Holgado en caderas, piernas rectas y tela rígida', 'Ajustado y elastizado', 'Piernas muy anchas', 'Corto al tobillo y elastizado'], 1,
 'El 90''s es holgado en caderas y de piernas rectas, confeccionado con telas rígidas.'),

('molderia', 2, 'Molderías VDH', '¿Qué diferencia hay entre el jean Wide y el Ultra Wide?',
 array['El Ultra Wide tiene las piernas ligeramente más anchas', 'El Wide es elastizado', 'El Ultra Wide es más corto', 'Ninguna'], 1,
 'Los dos son holgados en caderas y de tela rígida. El Ultra Wide (como el Breda Ultrawide) tiene las piernas un poco más anchas que el Wide (como el Chardi Wide).'),

('molderia', 3, 'Molderías VDH', '¿Cuál de estos jeans es de tela elastizada?',
 array['Kelian 90s', 'Chardi Wide', 'Rucci Relax', 'Team Baggy'], 3,
 'El Denim regular y el Relax son elastizados. El 90''s, el Wide, el Ultra Wide y el Baggy son de tela rígida.'),

('molderia', 2, 'Molderías VDH', '¿Cómo es el jean Baggy, como el Team Baggy?',
 array['El calce más amplio y las piernas más anchas, tela rígida', 'Ajustado y elastizado', 'Recto y elastizado', 'Corto al tobillo'], 1,
 'El Baggy tiene el calce más amplio y las piernas más anchas, en tela rígida.'),

('molderia', 1, 'Molderías VDH', '¿Qué calce tiene la camisa Fit, como la Sigma?',
 array['Entallado', 'Oversize', 'Regular', 'Boxy'], 1,
 'La Fit es entallada. La Regular (Venecia, Bucare) es ligeramente entallada y la Oversize (Marco Over) es suelta con hombro caído.'),

('molderia', 3, 'Molderías VDH', 'En nuestros jeans, ¿qué es la badana?',
 array['El bolsillo chico', 'La etiqueta trasera, en PU personalizada', 'El forro del bolsillo', 'El botón de bronce'], 2,
 'La badana es la etiqueta trasera. La nuestra es de PU personalizada.'),

('molderia', 2, 'Molderías VDH', '¿Para qué sirve la doble presilla (pasacinto) de atrás en nuestros jeans?',
 array['Es solo decorativa', 'Para más comodidad al usar cinturón', 'Para colgar llaves', 'Para reforzar el bolsillo'], 2,
 'Los jeans llevan costuras reforzadas y, atrás, doble presilla para más comodidad al usar cinturón.'),

('molderia', 3, 'Molderías VDH', '¿Qué detalles de calidad tienen nuestros jeans?',
 array['Cierres YKK de bronce y botones y remaches personalizados con logo', 'Cierres plásticos', 'Botones sin marca', 'No tienen detalles especiales'], 1,
 'Llevan cierres YKK de bronce, botones y remaches personalizados con logo y badana de PU personalizada. Sirve para explicarle al cliente la calidad.'),

-- ---------------------- CÓMO TRABAJAMOS (RETAIL) ----------------------
('retail', 1, 'Manual Retail 2025', 'Tarjeta bancaria Visa, Master o Cabal en 3 cuotas sin interés. ¿Qué código ingresás en el posnet?',
 array['3', '13', '16', '11'], 2,
 'Con tarjeta bancaria se usa "Ingresar más cuotas": 13 para 3 cuotas sin interés y 16 para 6 cuotas sin interés.'),

('retail', 1, 'Manual Retail 2025', 'Tarjeta bancaria en 6 cuotas sin interés. ¿Qué código ingresás?',
 array['6', '13', '16', '7'], 3,
 'El 16 es para 6 cuotas sin interés con tarjeta bancaria. El 13 es para 3.'),

('retail', 2, 'Manual Retail 2025', 'Tarjeta Visa o Master NO bancaria. ¿Qué podés ofrecer sin interés?',
 array['3 cuotas, con el código 3', '6 cuotas, con el código 16', '12 cuotas', 'Ninguna cuota sin interés'], 1,
 'Las no bancarias tienen solo 3 cuotas sin interés (código 3). El resto de las cuotas que aparecen en el sistema tienen recargo.'),

('retail', 2, 'Manual Retail 2025', 'Un cliente quiere pagar con Plan Z de Naranja X. ¿Qué código usás?',
 array['1', '3', '11', '13'], 3,
 'Plan Z: código 11. Para 1 cuota con Naranja X: código 1. En los dos casos el banco le cobra un recargo al cliente.'),

('retail', 1, 'Manual Retail 2025', 'Es martes y el cliente tiene la promo de su banco con 35% de descuento. ¿Qué hacés?',
 array['Le hago el 35% de descuento en el sistema', 'Paso el monto total del sistema; el descuento se lo reintegra el banco', 'Le digo que la promo no aplica', 'Le cobro la mitad en efectivo'], 2,
 'Nosotros no hacemos ningún descuento. El banco o la financiera reintegra el descuento, y aparece en el próximo resumen o en el siguiente (1 o 2 meses).'),

('retail', 2, 'Manual Retail 2025', 'Un cliente paga con una tarjeta Maestro. ¿Cómo se pasa?',
 array['En cuotas si las ofrece', 'Se elige "caja de ahorro", el cliente pone su PIN y va siempre en un pago', 'Como crédito', 'No se acepta'], 2,
 'Maestro es débito: se elige "caja de ahorro", el cliente ingresa su PIN de 4 dígitos y, aunque el posnet ofrezca cuotas, va sí o sí en un pago.'),

('retail', 2, 'Manual Retail 2025', 'Un cliente trae una gift card de un banco. ¿Cómo la cobrás?',
 array['Como crédito en 3 cuotas', 'Por el posnet como débito, sin cuotas', 'No se aceptan', 'Con el link de Mercado Pago'], 2,
 'Las gift cards bancarias se pasan como una tarjeta de débito normal, sin cuotas. Puede pasar que no alcance el monto.'),

('retail', 2, 'Manual Retail 2025', 'El posnet de Payway rechaza una operación. ¿Qué se hace?',
 array['Llamar al teléfono de autorizaciones', 'El cliente paga con otra tarjeta u otro medio de pago', 'Pasarla 5 veces seguidas', 'Anotarla y cobrarla al otro día'], 2,
 'En Payway ya no hay teléfonos para autorizaciones: es todo online. Si sale rechazada, el cliente paga con otra tarjeta u otro medio.'),

('retail', 2, 'Manual Retail 2025', '¿Qué es el CAE?',
 array['Un código de descuento', 'El código que da AFIP al autorizar una factura electrónica; sin él la factura no tiene validez fiscal', 'El número de la caja', 'Un tipo de tarjeta'], 2,
 'CAE significa Código de Autorización Electrónico. Sin CAE, la factura no tiene validez fiscal.'),

('retail', 1, 'Manual Retail 2025', '¿Cuándo se hace una factura A?',
 array['En todas las ventas', 'Solo si el cliente la pide', 'Solo los sábados', 'Cuando la venta es en efectivo'], 2,
 'La factura A se hace solo si el cliente la pide. Después de cargar sus datos, hay que verificar que el ticket esté en "A" y con la opción de generar factura tildada.'),

('retail', 2, 'Manual Retail 2025', 'En un retiro de fondos, ¿qué datos lleva la faja de papel del dinero?',
 array['Solo el monto', 'Monto, fecha, local, y firma y aclaración del responsable', 'El nombre del cliente', 'El número de factura'], 2,
 'La faja lleva monto, fecha, local, y firma y aclaración del responsable. Después se envuelve con el nombre del local, la fecha y la firma, en una bolsa bien cerrada.'),

('retail', 2, 'Manual Retail 2025', '¿Cuál es el depósito del sistema en el que se descuenta lo que vendemos y se suma lo que manda la fábrica?',
 array['Depósito de Temporada', 'Depósito de Ventas', 'Depósito de Envío entre Locales', 'Depósito de Devoluciones'], 2,
 'Trabajamos en el Depósito de Ventas. El de Temporada se usa en los cambios de temporada y el de Envío entre Locales para mandar o recibir ropa de otro local.'),

('retail', 3, 'Manual Retail 2025', 'Vas a mandar mercadería a otro local. En el sistema, ¿a qué depósito va como destino?',
 array['Depósito de Ventas', 'Depósito de Envío entre Locales', 'Depósito de Temporada', 'Al depósito del otro local directo'], 2,
 'Si enviás, el destino es "Depósito Envío entre Locales". Si recibís, el origen es ese depósito y el destino es el que estén usando. En observaciones se detalla el movimiento.'),

('retail', 2, 'Manual Retail 2025', 'Hacés una nota de crédito de una venta que tuvo dos descuentos. ¿A qué tenés que prestar atención?',
 array['A nada, se calcula sola', 'La nota de crédito toma solo el primer descuento: hay que agregar el otro para que coincidan los montos', 'Hay que borrar la venta original', 'Hay que hacerla dos veces'], 2,
 'La nota de crédito solo toma el primer descuento. Hay que agregar el que falta para que el ticket y la nota tengan el mismo monto. Se hace una sola vez y la venta no se borra.'),

('retail', 2, 'Manual Retail 2025', '¿Cuándo se mandan el reporte de IVA y el de percepciones de Ingresos Brutos?',
 array['Todos los viernes', 'El 1° de cada mes, con los datos del mes anterior', 'Cuando lo pida el supervisor', 'Una vez por año'], 2,
 'Los dos se hacen el 1° de cada mes con el mes anterior completo, y se mandan por mail a administración. El error más común es poner mal las fechas del mes.'),

('retail', 1, 'Manual Retail 2025', '¿Cuándo conviene usar el link manual de Mercado Pago?',
 array['Siempre, en todas las ventas', 'Cuando no anda el posnet o el cliente quiere cuotas sin interés con una tarjeta que no tenemos', 'Solo para pagos en efectivo', 'Nunca'], 2,
 'Se usa si no anda el posnet o si el cliente quiere cuotas sin interés con una tarjeta que no tenemos (por ejemplo, American sin entidad bancaria). Hay que explicarle que es una herramienta oficial y segura.'),

('retail', 2, 'Manual Retail 2025', 'El cliente paga con el link de Mercado Pago y quiere cuotas. ¿Qué le avisás?',
 array['Que toque "Pagar" enseguida', 'Que espere unos segundos a que carguen las opciones de cuotas; si paga enseguida, sale en 1 cuota', 'Que no se pueden hacer cuotas', 'Que mande una foto de la tarjeta'], 2,
 'En el último paso tiene que esperar a que carguen las cuotas. Si toca "Pagar" enseguida, sale en 1 cuota.'),

('retail', 1, 'Manual Retail 2025', 'El posnet da "error de comunicación". ¿Qué hacés primero?',
 array['Lo apagás y lo guardás', 'Revisás la conexión y probás la opuesta: si está en 4G, pasalo a Wi-Fi, y al revés', 'Llamás a la fábrica', 'Le pedís efectivo al cliente'], 2,
 'Primero, cambiar de conexión (4G ↔ Wi-Fi). Si sigue, se inicializa: menú de tres líneas → Funciones → Inicialización, y se espera sin tocarlo.'),

('retail', 3, 'Manual Retail 2025', '¿Dónde está la opción para inicializar el posnet?',
 array['En Ventas → Anular', 'En el menú de tres líneas → Funciones → Inicialización', 'Apretando el botón verde 10 segundos', 'En Configuración → Wi-Fi'], 2,
 'Menú desplazable (tres líneas arriba a la izquierda) → Funciones → Inicialización. Tarda unos minutos: no hay que tocarlo hasta que vuelva solo a la pantalla principal.'),

('retail', 2, 'Manual Retail 2025', '¿Qué se necesita para hacer una devolución a la fábrica?',
 array['Nada, se manda directo', 'Que la apruebe el supervisor y coordinar con depósito y con logística', 'Solo avisar por WhatsApp', 'Esperar a fin de mes'], 2,
 'Tiene que estar aprobada por el supervisor, hay que coordinar con depósito que haya espacio y con logística el retiro de los bultos.'),

('retail', 3, 'Manual Retail 2025', 'En una devolución hay prendas de primera y prendas falladas. ¿Cómo se arman los bultos?',
 array['Todo junto en un bulto', 'En bultos separados, con cartel, y las falladas con una cinta en la falla', 'Solo se mandan las falladas', 'Las falladas se tiran'], 2,
 'Primera y falladas van en bultos distintos y bien rotulados. Las falladas llevan una cinta en la falla, y además se separan por temporada (invierno o verano).'),

('retail', 2, 'Manual Retail 2025', '¿Qué datos lleva el rótulo de cada bulto de una devolución?',
 array['Solo el nombre del local', 'Local, cantidad de bultos (ej. 1/5), fecha de envío y número de remito de devolución', 'El nombre del vendedor', 'El precio de las prendas'], 2,
 'Cada bulto lleva local (o franquiciado o cliente), cantidad de bultos (1/5, 2/5…), fecha de envío y el número de remito de devolución del sistema.');

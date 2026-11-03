/* Cómo es el mueble de cada módulo, local por local, para el observador en 3D (croquis3d.js). Los locales que no están
   acá se arman con los muebles de siempre (según qué hay en cada módulo).
   - fichas: por el número del módulo (el que se ve en el croquis; el de los del medio, el de la vista). tipo: carro,
     accesoriosCaja, zapatos, mallaAncho, percheroDoble, percheroTubo, rackDoble; o, en la pared, las bahías del mueble
     de izquierda a derecha (col: columna de estantes; frente: prendas colgadas de frente; maniqui; simple: estantes y
     barrales; libre: estante por estante, como la foto, con una o varias prendas de frente, cintos y bolsas colgadas)
     y lo que cuelga del barral de abajo (barralCol: sus colores, como la foto; en simple, el cuarto dato del barral).
   - entre: lo que va entre dos módulos de la pared (un espejo, maniquíes).
   - lugares: lo que hay en un lugar de la pared que no es módulo, por su nombre en el croquis (en minúscula): un
     maniquí en su base, la tabla de las zapatillas (zapatillero), el perchero angosto con ganchos en cascada.
   - medioDeposito: la mesa negra del medio del depósito. */
export const LOCALES_3D = {
  /* Rivadavia: de las fotos de Mauricio (15/10/2026), módulo por módulo. */
  '7ce69820-6c1b-48a2-bdaa-4a546f448522': {
    medioDeposito: true,
    fichas: {
      "1": {"tipo":"carro","arriba":"busto","colgada":"saco","doblada":"pantalon"},
      "2": {"peso":0.9,"bahias":[{"k":"simple","niveles":[["estante",0.9,"camisa"],["barral",0.86,"camisa"],["estante",0.5],["barral",0.46,"pantalon"]]}]},
      "3": {"peso":1.9,"bahias":[{"k":"col","ropa":"bermuda"},{"k":"frente","ropa":"remera","cartel":true},{"k":"col","ropa":"jean"}],"barral":"jean"},
      "4": {"peso":1.15,"bahias":[{"k":"frente","ropa":"remera","piernas":"bermuda"}],"barral":"bermuda"},
      "5": {"peso":3.2,"hs":0.48,"barral":"remera","bahias":[{"k":"libre","w":0.19,"estantes":[[0.85,"remera"],[0.69,"medias"]],"piernas":{"fr":0.16,"ropa":"jean"},"bolsa":0},{"k":"libre","w":0.17,"estantes":[[0.8,"medias"],[0.64,"remera"]],"largo":true,"barral":true},{"k":"libre","w":0.26,"estantes":[[0.86,"remera"]],"frente":{"fr":0.8,"ropa":"remera","capas":3,"col":"#F2F0EB"},"largo":true,"barral":true,"cartel":true,"sobreLargo":["bolso","cintos"]},{"k":"libre","w":0.2,"estantes":[[0.76,"remera"],[0.63,"remera"]],"largo":true,"barral":true},{"k":"libre","w":0.17,"estantes":[[0.75,"remera"],[0.63,"medias"],[0.27,"bolso"],[0.13,"jean"]],"frente":{"fr":0.59,"ropa":"remera","col":"#4A4D52"}}]},
      "6": {"peso":0.9,"bahias":[{"k":"simple","niveles":[["estante",0.9,"buzo"],["barral",0.86,"buzo"],["estante",0.47],["barral",0.43,"buzo"]]}]},
      "7": {"peso":1.9,"bahias":[{"k":"col","ropa":"buzo","bajo":true},{"k":"frente","ropa":"remera","cartel":true},{"k":"col","ropa":"buzo"}],"barral":"pantalon"},
      "8": {"peso":0.9,"bahias":[{"k":"simple","niveles":[["estante",0.86,"camisa"],["estante",0.63,"camisa"],["barral",0.59,"camisa"]]}]},
      "9": {"peso":1.7,"bahias":[{"k":"maniqui","completo":{"arriba":"remera","abajo":"bermuda","colArriba":"#E8E1D3","colAbajo":"#9DB0C6","gorra":true,"colGorra":"#C9733A"}},{"k":"frente","ropa":"campera","cartel":true},{"k":"col","ropa":"jean"}],"barral":"campera"},
      "10": {"tipo":"accesoriosCaja"},
      "11": {"tipo":"zapatos","peso":1.3},
      "12": {"peso":2,"bahias":[{"k":"col","ropa":"buzo"},{"k":"frente","ropa":"buzo","cartel":true},{"k":"col","ropa":"buzo"}],"barral":"buzo"},
      "13": {"peso":1,"bahias":[{"k":"frente","ropa":"buzo","cartel":true}],"barral":"buzo"},
      "14": {"peso":2,"bahias":[{"k":"col","ropa":"buzo"},{"k":"frente","ropa":"campera","cartel":true},{"k":"col","ropa":"buzo"}],"barral":"buzo"},
      "15": {"peso":1.7,"bahias":[{"k":"maniqui","completo":{"arriba":"campera","abajo":"pantalon","colArriba":"#E9E2D2","colAbajo":"#1E1F22","gorro":true}},{"k":"frente","ropa":"pantalon","colgados":3,"cartel":true}],"barral":"pantalon"},
      "16": {"peso":2.6,"bahias":[{"k":"col","ropa":"jean","w":0.7},{"k":"col","ropa":"jean"},{"k":"col","ropa":"jean"},{"k":"col","ropa":"jean"},{"k":"col","ropa":"jean","w":0.7}],"barral":"jean","cintos":true},
      "17": {"peso":2,"bahias":[{"k":"col","ropa":"camisa"},{"k":"frente","ropa":"camisa","cartel":true},{"k":"col","ropa":"camisa"}],"barral":"camisa"},
      "18": {"tipo":"mallaAncho","peso":2.1},
      "19": {"peso":0.9,"bahias":[{"k":"simple","niveles":[["estante",0.9,"remera"],["barral",0.86,"remera"],["estante",0.5],["barral",0.46,"bermuda"]]}]},
      "20": {"tipo":"carro","arriba":"bolsos","colgada":"camisa","doblada":"remera"},
      "21": {"tipo":"percheroDoble","ropa":"remera","ropa2":"camisa"},
      "22": {"tipo":"percheroTubo","ropa":"remera"},
      "23": {"tipo":"rackDoble","ropa":"pantalon","doblada":"jean"}
    },
    entre: [
      [2,3,{"tipo":"maniquies"}],
      [4,5,{"tipo":"espejo"}],
      [5,6,{"tipo":"espejo"}],
      [15,16,{"tipo":"maniqui","base":"cajaBlanca","ropa":{"arriba":"remera","abajo":"pantalon","colArriba":"#ECE4D0","colAbajo":"#C9D0C4","gorra":true,"colGorra":"#F2F0EB"}}],
      [16,17,{"tipo":"maniqui","base":"cajaNegra","ropa":{"arriba":"camisa","abajo":"jean","colArriba":"#F2F0EB","colAbajo":"#3A3F47","zapas":"negro"}}]
    ]
  },
  /* Lomas de Zamora: de las fotos de Mauricio (2/11/2026). El local numeró la pared derecha de adelante hacia atrás; el
     croquis da la vuelta (como en Rivadavia): su 8 es el 5, su 7 el 6, su 6 el 7 y su 5 el 8. */
  '4458a46f-5295-4b6a-844f-5884c77f66f9': {
    fichas: {
      "1": {"bahias":[{"k":"col","ropa":"jean","bajo":true},{"k":"col","ropa":"jean"},{"k":"frente","ropa":"remera","col":"#ECE8F2"},{"k":"col","ropa":"jean"},{"k":"col","ropa":"jean","bajo":true}],"barral":"pantalon",
            "barralCol":["#E8DFCC","#1E1F22","#8FA6C1","#6F86A3","#26272A","#55575A","#2C3446","#B9AE92","#D8CDB5","#6B4E3E","#EDE6D6"]},
      "2": {"bahias":[{"k":"simple","niveles":[["estante",0.98,"remera"],["barral",0.9,"remera",["#F6F5F1","#F2F0EB","#EEEBE3","#E8E2D2","#EFE3A0","#F4F3EF","#E4DCC8","#3F4A5C"]],["estante",0.5],
            ["barral",0.46,"camisa",["#D9D9D4","#A7A9A6","#6E6F6D","#3A3B3D","#26272A","#4B2E3A","#E9C9CF","#9DB3CC"]]]}]},
      "3": {"bahias":[{"k":"libre","estantes":[[0.98,"remera"],[0.74,"remera"],[0.56,"gorra"]],"frente":{"fr":0.52,"x":0.32,"ropa":"campera","col":"#D6D6D0","hasta":0.1},"cintos":[0.52,0.6,0.95]}]},
      "4": {"tipo":"accesoriosCaja","sinPared":true},
      "5": {"peso":1.1,"bahias":[{"k":"libre","w":0.75,"bolsas":[[0.86,"tote","#E07A2E"],[0.58,"mochila","#E4DAC2"],[0.32,"tote","#DCD7CC"]]},{"k":"col","ropa":"buzo","bajo":true},{"k":"col","ropa":"remera","bajo":true}]},
      "6": {"peso":1.9,"barral":"campera","barralCol":["#F2F0EB","#1E1F22","#3A3D42","#D9534A","#A9C4DA","#E8C9A8","#3F5470","#26324A","#6E8FB0","#8C8F93","#D9B8A8","#EDE6D6"],"bahias":[{"k":"col","ropa":"remera","bajo":true},{"k":"frente","ropa":"remera","col":"#5E6B4E"},{"k":"col","ropa":"remera","w":0.7}]},
      "7": {"peso":1.5,"bahias":[{"k":"libre","estantes":[[0.98,"jean"]],"frente":[{"fr":0.86,"ropa":"remera","col":"#EDE6D6","hasta":0.56},{"fr":0.5,"ropa":"bermuda","col":"#CFC6B4","hasta":0.14}]},{"k":"libre","estantes":[[0.98,"remera"]],"frente":[{"fr":0.86,"ropa":"remera","col":"#1E1F22","hasta":0.5},{"fr":0.5,"ropa":"jean","col":"#3F5470","hasta":0.03}]},{"k":"libre","estantes":[[0.98,"remera"]],"frente":[{"fr":0.86,"ropa":"remera","col":"#F2F0EB","hasta":0.56},{"fr":0.5,"ropa":"bermuda","col":"#1E1F22","hasta":0.14}]}]},
      "8": {"peso":1.9,"barral":"campera","barralCol":["#1E1F22","#2A2D33","#A9C4DA","#C9AA88","#E8664A","#B04040","#D9A9B0","#B49AA0","#DCCFB8","#5FAF6B","#EDE6D6","#2F6FC0","#6E7276","#F4F3EF"],"bahias":[{"k":"col","ropa":"gorra","w":0.75},{"k":"frente","ropa":"campera","col":"#2F6FC0"},{"k":"col","ropa":"remera","bajo":true}]}
    },
    lugares: {
      "maniquí": {"tipo":"maniqui","base":"carroBajo","ropa":{"negro":true,"arriba":"remera","abajo":"bermuda","colArriba":"#ECE8DD","colAbajo":"#1E1F22","gorra":true,"colGorra":"#2A2B2E","zapas":"negro"}},
      "zapatillas": {"tipo":"zapatillero","pila":"izquierda"},
      "perchero": {"tipo":"cascada","lado":-1,"malla":1,"prendas":[[0.84,"remera","#F2F0EB"],[0.46,"pantalon","#1E1F22"]]}
    }
  }
};

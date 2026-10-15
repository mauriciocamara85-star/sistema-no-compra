/* Cómo es el mueble de cada módulo, local por local, para el observador en 3D (croquis3d.js). Los locales que no están
   acá se arman con los muebles de siempre (según qué hay en cada módulo).
   - fichas: por el número del módulo (el que se ve en el croquis; el de los del medio, el de la vista). tipo: carro,
     accesoriosCaja, zapatos, mallaAncho, percheroDoble, percheroTubo, rackDoble; o, en la pared, las bahías del mueble
     de izquierda a derecha (col: columna de estantes; frente: prendas colgadas de frente; maniqui; simple: estantes y
     barrales; libre: estante por estante, como la foto) y lo que cuelga del barral de abajo.
   - entre: lo que va entre dos módulos de la pared (un espejo, maniquíes).
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
  }
};

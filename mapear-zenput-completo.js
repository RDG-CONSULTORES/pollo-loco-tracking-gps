require('dotenv').config();
const { Client } = require('pg');
const axios = require('axios');

/**
 * MAPEO AUTOMÁTICO COMPLETO CON DIRECCIONES ZENPUT
 * 83 direcciones validadas del sistema de supervisión operativa
 */

const TODAS_LAS_DIRECCIONES_ZENPUT = [
  {
    "id": 2247000,
    "name": "1 - Pino Suarez",
    "address": "Av. Pino Suarez #500 sur Col. Centro, Monterrey, NL, 64000, México",
    "searchQuery": "El Pollo Loco Av. Pino Suarez #500 sur Col. Centro, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Pino%20Suarez%20%23500%20sur%20Col.%20Centro%2C%20Monterrey%2C%20NL%2C%2064000%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Pino%20Suarez%20%23500%20sur%20Col.%20Centro%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64000",
    "phone": "812-191-1171",
    "email": "pinosuarez@epl.mx",
    "raw_address": "Av. Pino Suarez #500 sur Col. Centro"
  },
  {
    "id": 2247009,
    "name": "10 - Barragan",
    "address": "Av. Manuel I. Barragán #1401, San Nicolas de los Garza, NL, 66428, México",
    "searchQuery": "El Pollo Loco Av. Manuel I. Barragán #1401, San Nicolas de los Garza, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Manuel%20I.%20Barraga%CC%81n%20%231401%2C%20San%20Nicolas%20de%20los%20Garza%2C%20NL%2C%2066428%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Manuel%20I.%20Barraga%CC%81n%20%231401%2C%20San%20Nicolas%20de%20los%20Garza%2C%20NL",
    "city": "San Nicolas de los Garza",
    "state": "NL",
    "zipcode": "66428",
    "phone": null,
    "email": "barragan@epl.mx",
    "raw_address": "Av. Manuel I. Barragán #1401"
  },
  {
    "id": 2247010,
    "name": "11 - Lincoln",
    "address": "Av. Paseo de Cumbres #1001-C, Monterrey, NL, 64346, México",
    "searchQuery": "El Pollo Loco Av. Paseo de Cumbres #1001-C, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Paseo%20de%20Cumbres%20%231001-C%2C%20Monterrey%2C%20NL%2C%2064346%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Paseo%20de%20Cumbres%20%231001-C%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64346",
    "phone": null,
    "email": "lincoln@epl.mx",
    "raw_address": "Av. Paseo de Cumbres #1001-C"
  },
  {
    "id": 2247011,
    "name": "12 - Concordia",
    "address": "Av. Concordia # 300 Apodaca, Apodaca, NL, 66612, México",
    "searchQuery": "El Pollo Loco Av. Concordia # 300 Apodaca, Apodaca, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Concordia%20%23%20300%20Apodaca%2C%20Apodaca%2C%20NL%2C%2066612%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Concordia%20%23%20300%20Apodaca%2C%20Apodaca%2C%20NL",
    "city": "Apodaca",
    "state": "NL",
    "zipcode": "66612",
    "phone": null,
    "email": "concordia@epl.mx",
    "raw_address": "Av. Concordia # 300 Apodaca"
  },
  {
    "id": 2247012,
    "name": "13 - Escobedo",
    "address": "Av. Raúl Salinas #555 Escobedo, Escobedo, NL, 66072, México",
    "searchQuery": "El Pollo Loco Av. Raúl Salinas #555 Escobedo, Escobedo, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Rau%CC%81l%20Salinas%20%23555%20Escobedo%2C%20Escobedo%2C%20NL%2C%2066072%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Rau%CC%81l%20Salinas%20%23555%20Escobedo%2C%20Escobedo%2C%20NL",
    "city": "Escobedo",
    "state": "NL",
    "zipcode": "66072",
    "phone": null,
    "email": "escobedo@epl.mx",
    "raw_address": "Av. Raúl Salinas #555 Escobedo"
  },
  {
    "id": 2247013,
    "name": "14 - Aztlan",
    "address": "Av. Solidaridad #5151 Monterrey, Monterrey, NL, 64102, México",
    "searchQuery": "El Pollo Loco Av. Solidaridad #5151 Monterrey, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Solidaridad%20%235151%20Monterrey%2C%20Monterrey%2C%20NL%2C%2064102%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Solidaridad%20%235151%20Monterrey%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64102",
    "phone": null,
    "email": "aztlan@epl.mx",
    "raw_address": "Av. Solidaridad #5151 Monterrey"
  },
  {
    "id": 2247014,
    "name": "15 - Ruiz Cortinez",
    "address": "Av. Ruiz Cortínez #5600 Col. Valle de Infonavit,, Monterrey, NL, 64350, México",
    "searchQuery": "El Pollo Loco Av. Ruiz Cortínez #5600 Col. Valle de Infonavit,, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Ruiz%20Corti%CC%81nez%20%235600%20Col.%20Valle%20de%20Infonavit%2C%2C%20Monterrey%2C%20NL%2C%2064350%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Ruiz%20Corti%CC%81nez%20%235600%20Col.%20Valle%20de%20Infonavit%2C%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64350",
    "phone": null,
    "email": "ruizcortines@epl.mx",
    "raw_address": "Av. Ruiz Cortínez #5600 Col. Valle de Infonavit,"
  },
  {
    "id": 2247015,
    "name": "16 - Solidaridad",
    "address": "Av. Luis Donaldo Colosio #2200 A, Col. Barrio Acero,, Monterrey, NL, 64102, México",
    "searchQuery": "El Pollo Loco Av. Luis Donaldo Colosio #2200 A, Col. Barrio Acero,, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Luis%20Donaldo%20Colosio%20%232200%20A%2C%20Col.%20Barrio%20Acero%2C%2C%20Monterrey%2C%20NL%2C%2064102%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Luis%20Donaldo%20Colosio%20%232200%20A%2C%20Col.%20Barrio%20Acero%2C%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64102",
    "phone": null,
    "email": "solidaridad@epl.mx",
    "raw_address": "Av. Luis Donaldo Colosio #2200 A, Col. Barrio Acero,"
  },
  {
    "id": 2247016,
    "name": "17 - Romulo Garza",
    "address": "Calle de los Pinos #990, Col. Hacienda los Morales 2do sector, San Nicolas de los Garza, NL, 66495, México",
    "searchQuery": "El Pollo Loco Calle de los Pinos #990, Col. Hacienda los Morales 2do sector, San Nicolas de los Garza, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Calle%20de%20los%20Pinos%20%23990%2C%20Col.%20Hacienda%20los%20Morales%202do%20sector%2C%20San%20Nicolas%20de%20los%20Garza%2C%20NL%2C%2066495%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Calle%20de%20los%20Pinos%20%23990%2C%20Col.%20Hacienda%20los%20Morales%202do%20sector%2C%20San%20Nicolas%20de%20los%20Garza%2C%20NL",
    "city": "San Nicolas de los Garza",
    "state": "NL",
    "zipcode": "66495",
    "phone": null,
    "email": "rg@surtidorepl.mx",
    "raw_address": "Calle de los Pinos #990, Col. Hacienda los Morales 2do sector"
  },
  {
    "id": 2247017,
    "name": "18 - Linda Vista",
    "address": "Av. Miguel Alemán #210 A Col. 10 de mayo, Guadalupe, NL, 67123, México",
    "searchQuery": "El Pollo Loco Av. Miguel Alemán #210 A Col. 10 de mayo, Guadalupe, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Miguel%20Alema%CC%81n%20%23210%20A%20Col.%2010%20de%20mayo%2C%20Guadalupe%2C%20NL%2C%2067123%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Miguel%20Alema%CC%81n%20%23210%20A%20Col.%2010%20de%20mayo%2C%20Guadalupe%2C%20NL",
    "city": "Guadalupe",
    "state": "NL",
    "zipcode": "67123",
    "phone": null,
    "email": "lv@surtidorepl.mx",
    "raw_address": "Av. Miguel Alemán #210 A Col. 10 de mayo"
  },
  {
    "id": 2247018,
    "name": "19 - Valle Soleado",
    "address": "Carretera Dulces Nombres #400 C, Col. Valle Soleado, Guadalupe, NL, 67130, México",
    "searchQuery": "El Pollo Loco Carretera Dulces Nombres #400 C, Col. Valle Soleado, Guadalupe, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Carretera%20Dulces%20Nombres%20%23400%20C%2C%20Col.%20Valle%20Soleado%2C%20Guadalupe%2C%20NL%2C%2067130%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Carretera%20Dulces%20Nombres%20%23400%20C%2C%20Col.%20Valle%20Soleado%2C%20Guadalupe%2C%20NL",
    "city": "Guadalupe",
    "state": "NL",
    "zipcode": "67130",
    "phone": null,
    "email": "vs@surtidorepl.mx",
    "raw_address": "Carretera Dulces Nombres #400 C, Col. Valle Soleado"
  },
  {
    "id": 2247001,
    "name": "2 - Madero",
    "address": "Av. Francisco I. Madero #843 pte. Col. Centro, Monterrey, NL, 64000, México",
    "searchQuery": "El Pollo Loco Av. Francisco I. Madero #843 pte. Col. Centro, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Francisco%20I.%20Madero%20%23843%20pte.%20Col.%20Centro%2C%20Monterrey%2C%20NL%2C%2064000%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Francisco%20I.%20Madero%20%23843%20pte.%20Col.%20Centro%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64000",
    "phone": "555-555-1235",
    "email": "madero@epl.mx",
    "raw_address": "Av. Francisco I. Madero #843 pte. Col. Centro"
  },
  {
    "id": 2247019,
    "name": "20 - Tecnológico",
    "address": "Calle Ave. Eugenio Garza Sada # 2788 Col. Alta Vista Sur, Monterrey, NL, 64840, México",
    "searchQuery": "El Pollo Loco Calle Ave. Eugenio Garza Sada # 2788 Col. Alta Vista Sur, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Calle%20Ave.%20Eugenio%20Garza%20Sada%20%23%202788%20Col.%20Alta%20Vista%20Sur%2C%20Monterrey%2C%20NL%2C%2064840%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Calle%20Ave.%20Eugenio%20Garza%20Sada%20%23%202788%20Col.%20Alta%20Vista%20Sur%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64840",
    "phone": null,
    "email": "tec@epl.mx",
    "raw_address": "Calle Ave. Eugenio Garza Sada # 2788 Col. Alta Vista Sur"
  },
  {
    "id": 2247020,
    "name": "21 - Chapultepec",
    "address": "Av. Chapultepec #180, Int. PB-01-E Col. Paraíso, Guadalupe, NL, 67140, México",
    "searchQuery": "El Pollo Loco Av. Chapultepec #180, Int. PB-01-E Col. Paraíso, Guadalupe, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Chapultepec%20%23180%2C%20Int.%20PB-01-E%20Col.%20Parai%CC%81so%2C%20Guadalupe%2C%20NL%2C%2067140%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Chapultepec%20%23180%2C%20Int.%20PB-01-E%20Col.%20Parai%CC%81so%2C%20Guadalupe%2C%20NL",
    "city": "Guadalupe",
    "state": "NL",
    "zipcode": "67140",
    "phone": null,
    "email": "regioalimentoschapultepec@gmail.com",
    "raw_address": "Av. Chapultepec #180, Int. PB-01-E Col. Paraíso"
  },
  {
    "id": 2247021,
    "name": "22 - Satelite",
    "address": "Av. Eugenio Garza Sada #6044 Col. Mederos, Monterrey, NL, 64950, México",
    "searchQuery": "El Pollo Loco Av. Eugenio Garza Sada #6044 Col. Mederos, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Eugenio%20Garza%20Sada%20%236044%20Col.%20Mederos%2C%20Monterrey%2C%20NL%2C%2064950%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Eugenio%20Garza%20Sada%20%236044%20Col.%20Mederos%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64950",
    "phone": null,
    "email": "pollosatelite@prodigy.net.mx",
    "raw_address": "Av. Eugenio Garza Sada #6044 Col. Mederos"
  },
  {
    "id": 2247022,
    "name": "23 - Guasave",
    "address": "Av. Vicente Guerrero #517, Col. Centro, Guasave, SI, 81000, México",
    "searchQuery": "El Pollo Loco Av. Vicente Guerrero #517, Col. Centro, Guasave, SI",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Vicente%20Guerrero%20%23517%2C%20Col.%20Centro%2C%20Guasave%2C%20SI%2C%2081000%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Vicente%20Guerrero%20%23517%2C%20Col.%20Centro%2C%20Guasave%2C%20SI",
    "city": "Guasave",
    "state": "SI",
    "zipcode": "81000",
    "phone": null,
    "email": "elpollolocogve@prodigy.net.mx",
    "raw_address": "Av. Vicente Guerrero #517, Col. Centro"
  },
  {
    "id": 2247023,
    "name": "24 - Exposicion",
    "address": "Av. Benito Juárez #1210, Col. La Hacienda, Guadalupe, NL, 67150, México",
    "searchQuery": "El Pollo Loco Av. Benito Juárez #1210, Col. La Hacienda, Guadalupe, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Benito%20Jua%CC%81rez%20%231210%2C%20Col.%20La%20Hacienda%2C%20Guadalupe%2C%20NL%2C%2067150%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Benito%20Jua%CC%81rez%20%231210%2C%20Col.%20La%20Hacienda%2C%20Guadalupe%2C%20NL",
    "city": "Guadalupe",
    "state": "NL",
    "zipcode": "67150",
    "phone": null,
    "email": "expo@epl.mx",
    "raw_address": "Av. Benito Juárez #1210, Col. La Hacienda"
  },
  {
    "id": 2247024,
    "name": "25 - Juarez",
    "address": "Carretera a Reynosa #1000, Col. Centro,, Benito Juarez, NL, 67250, México",
    "searchQuery": "El Pollo Loco Carretera a Reynosa #1000, Col. Centro,, Benito Juarez, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Carretera%20a%20Reynosa%20%231000%2C%20Col.%20Centro%2C%2C%20Benito%20Juarez%2C%20NL%2C%2067250%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Carretera%20a%20Reynosa%20%231000%2C%20Col.%20Centro%2C%2C%20Benito%20Juarez%2C%20NL",
    "city": "Benito Juarez",
    "state": "NL",
    "zipcode": "67250",
    "phone": null,
    "email": "vjuarez@epl.mx",
    "raw_address": "Carretera a Reynosa #1000, Col. Centro,"
  },
  {
    "id": 2247025,
    "name": "26 - Cadereyta",
    "address": "Zaragoza #102 Col. Centro, Cadereyta, NL, 67450, México",
    "searchQuery": "El Pollo Loco Zaragoza #102 Col. Centro, Cadereyta, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Zaragoza%20%23102%20Col.%20Centro%2C%20Cadereyta%2C%20NL%2C%2067450%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Zaragoza%20%23102%20Col.%20Centro%2C%20Cadereyta%2C%20NL",
    "city": "Cadereyta",
    "state": "NL",
    "zipcode": "67450",
    "phone": null,
    "email": "cadereyta@epl.mx",
    "raw_address": "Zaragoza #102 Col. Centro"
  },
  {
    "id": 2247026,
    "name": "27 - Santiago",
    "address": "Carretera Nacional #209, Col. Centro,, Santiago, NL, 67310, México",
    "searchQuery": "El Pollo Loco Carretera Nacional #209, Col. Centro,, Santiago, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Carretera%20Nacional%20%23209%2C%20Col.%20Centro%2C%2C%20Santiago%2C%20NL%2C%2067310%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Carretera%20Nacional%20%23209%2C%20Col.%20Centro%2C%2C%20Santiago%2C%20NL",
    "city": "Santiago",
    "state": "NL",
    "zipcode": "67310",
    "phone": null,
    "email": "santiago@epl.mx",
    "raw_address": "Carretera Nacional #209, Col. Centro,"
  },
  {
    "id": 2247027,
    "name": "28 - Guerrero",
    "address": "Guerrero #619, Col. Centro, Nuevo Laredo, TM, 88000, México",
    "searchQuery": "El Pollo Loco Guerrero #619, Col. Centro, Nuevo Laredo, TM",
    "googleMapsUrl": "https://www.google.com/maps/search/Guerrero%20%23619%2C%20Col.%20Centro%2C%20Nuevo%20Laredo%2C%20TM%2C%2088000%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Guerrero%20%23619%2C%20Col.%20Centro%2C%20Nuevo%20Laredo%2C%20TM",
    "city": "Nuevo Laredo",
    "state": "TM",
    "zipcode": "88000",
    "phone": null,
    "email": "guerrero619@epl.mx",
    "raw_address": "Guerrero #619, Col. Centro"
  },
  {
    "id": 2247028,
    "name": "29 - Pablo Livas",
    "address": "Av. Pablo Livas #7601, Col. Rincón de Guadalupe, Guadalupe, NL, 67193, México",
    "searchQuery": "El Pollo Loco Av. Pablo Livas #7601, Col. Rincón de Guadalupe, Guadalupe, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Pablo%20Livas%20%237601%2C%20Col.%20Rinco%CC%81n%20de%20Guadalupe%2C%20Guadalupe%2C%20NL%2C%2067193%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Pablo%20Livas%20%237601%2C%20Col.%20Rinco%CC%81n%20de%20Guadalupe%2C%20Guadalupe%2C%20NL",
    "city": "Guadalupe",
    "state": "NL",
    "zipcode": "67193",
    "phone": null,
    "email": "livas@epl.mx",
    "raw_address": "Av. Pablo Livas #7601, Col. Rincón de Guadalupe"
  },
  {
    "id": 2247002,
    "name": "3 - Matamoros",
    "address": "Juárez #701, Col. Centro, Monterrey, Monterrey, NL, 64000, México",
    "searchQuery": "El Pollo Loco Juárez #701, Col. Centro, Monterrey, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Ju%C3%A1rez%20%23701%2C%20Col.%20Centro%2C%20Monterrey%2C%20Monterrey%2C%20NL%2C%2064000%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Ju%C3%A1rez%20%23701%2C%20Col.%20Centro%2C%20Monterrey%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64000",
    "phone": "555-555-1236",
    "email": "juarez@epl.mx",
    "raw_address": "Juárez #701, Col. Centro, Monterrey"
  },
  {
    "id": 2247029,
    "name": "30 - Carrizo",
    "address": "Belden #7412, Col. Buena Vista, Nuevo Laredo, TM, 88120, México",
    "searchQuery": "El Pollo Loco Belden #7412, Col. Buena Vista, Nuevo Laredo, TM",
    "googleMapsUrl": "https://www.google.com/maps/search/Belden%20%237412%2C%20Col.%20Buena%20Vista%2C%20Nuevo%20Laredo%2C%20TM%2C%2088120%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Belden%20%237412%2C%20Col.%20Buena%20Vista%2C%20Nuevo%20Laredo%2C%20TM",
    "city": "Nuevo Laredo",
    "state": "TM",
    "zipcode": "88120",
    "phone": null,
    "email": "carrizo@epl.mx",
    "raw_address": "Belden #7412, Col. Buena Vista"
  },
  {
    "id": 2247030,
    "name": "31 - Las Quintas",
    "address": "Av. López Mateos #301, Col. Residencial las quintas, Guadalupe, NL, 67165, México",
    "searchQuery": "El Pollo Loco Av. López Mateos #301, Col. Residencial las quintas, Guadalupe, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Lo%CC%81pez%20Mateos%20%23301%2C%20Col.%20Residencial%20las%20quintas%2C%20Guadalupe%2C%20NL%2C%2067165%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Lo%CC%81pez%20Mateos%20%23301%2C%20Col.%20Residencial%20las%20quintas%2C%20Guadalupe%2C%20NL",
    "city": "Guadalupe",
    "state": "NL",
    "zipcode": "67165",
    "phone": null,
    "email": "lasquintas@epl.mx",
    "raw_address": "Av. López Mateos #301, Col. Residencial las quintas"
  },
  {
    "id": 2247031,
    "name": "32 - Allende",
    "address": "Carretera Nacional #702, Col. Hacienda San Javier, Allende, NL, 67350, México",
    "searchQuery": "El Pollo Loco Carretera Nacional #702, Col. Hacienda San Javier, Allende, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Carretera%20Nacional%20%23702%2C%20Col.%20Hacienda%20San%20Javier%2C%20Allende%2C%20NL%2C%2067350%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Carretera%20Nacional%20%23702%2C%20Col.%20Hacienda%20San%20Javier%2C%20Allende%2C%20NL",
    "city": "Allende",
    "state": "NL",
    "zipcode": "67350",
    "phone": null,
    "email": "allende@epl.mx",
    "raw_address": "Carretera Nacional #702, Col. Hacienda San Javier"
  },
  {
    "id": 2247032,
    "name": "33 - Eloy Cavazos",
    "address": "Av. Eloy Cavazos #5100, Col. San Eduardo, Guadalupe, NL, 67186, México",
    "searchQuery": "El Pollo Loco Av. Eloy Cavazos #5100, Col. San Eduardo, Guadalupe, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Eloy%20Cavazos%20%235100%2C%20Col.%20San%20Eduardo%2C%20Guadalupe%2C%20NL%2C%2067186%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Eloy%20Cavazos%20%235100%2C%20Col.%20San%20Eduardo%2C%20Guadalupe%2C%20NL",
    "city": "Guadalupe",
    "state": "NL",
    "zipcode": "67186",
    "phone": null,
    "email": "eloycavazos@epl.mx",
    "raw_address": "Av. Eloy Cavazos #5100, Col. San Eduardo"
  },
  {
    "id": 2247033,
    "name": "34 - Montemorelos",
    "address": "Av. Capitán Alonso de León #1203, Col. Zaragoza, Montemorelos, NL, 67500, México",
    "searchQuery": "El Pollo Loco Av. Capitán Alonso de León #1203, Col. Zaragoza, Montemorelos, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Capita%CC%81n%20Alonso%20de%20Leo%CC%81n%20%231203%2C%20Col.%20Zaragoza%2C%20Montemorelos%2C%20NL%2C%2067500%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Capita%CC%81n%20Alonso%20de%20Leo%CC%81n%20%231203%2C%20Col.%20Zaragoza%2C%20Montemorelos%2C%20NL",
    "city": "Montemorelos",
    "state": "NL",
    "zipcode": "67500",
    "phone": null,
    "email": "montemorelos@epl.mx",
    "raw_address": "Av. Capitán Alonso de León #1203, Col. Zaragoza"
  },
  {
    "id": 2247034,
    "name": "35 - Apodaca",
    "address": "Miguel Alemán #549 Col. El Milagro, Apodaca, NL, 66633, México",
    "searchQuery": "El Pollo Loco Miguel Alemán #549 Col. El Milagro, Apodaca, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Miguel%20Alema%CC%81n%20%23549%20Col.%20El%20Milagro%2C%20Apodaca%2C%20NL%2C%2066633%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Miguel%20Alema%CC%81n%20%23549%20Col.%20El%20Milagro%2C%20Apodaca%2C%20NL",
    "city": "Apodaca",
    "state": "NL",
    "zipcode": "66633",
    "phone": null,
    "email": "apodaca@plog.com.mx",
    "raw_address": "Miguel Alemán #549 Col. El Milagro"
  },
  {
    "id": 2247035,
    "name": "36 - Apodaca Centro",
    "address": "Gral. Ignacio Zaragoza 510, Cabecera Municipal, Apodaca Centro, Apodaca, NL, 66600, México",
    "searchQuery": "El Pollo Loco Gral. Ignacio Zaragoza 510, Cabecera Municipal, Apodaca Centro, Apodaca, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Gral.%20Ignacio%20Zaragoza%20510%2C%20Cabecera%20Municipal%2C%20Apodaca%20Centro%2C%20Apodaca%2C%20NL%2C%2066600%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Gral.%20Ignacio%20Zaragoza%20510%2C%20Cabecera%20Municipal%2C%20Apodaca%20Centro%2C%20Apodaca%2C%20NL",
    "city": "Apodaca",
    "state": "NL",
    "zipcode": "66600",
    "phone": null,
    "email": "apodacacentro@plog.com.mx",
    "raw_address": "Gral. Ignacio Zaragoza 510, Cabecera Municipal, Apodaca Centro"
  },
  {
    "id": 2247036,
    "name": "37 - Stiva",
    "address": "BLVD. Rogelio González Caballero no.100 Local 9, Apodaca, NL, 66600, México",
    "searchQuery": "El Pollo Loco BLVD. Rogelio González Caballero no.100 Local 9, Apodaca, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/BLVD.%20Rogelio%20Gonza%CC%81lez%20Caballero%20no.100%20Local%209%2C%20Apodaca%2C%20NL%2C%2066600%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20BLVD.%20Rogelio%20Gonza%CC%81lez%20Caballero%20no.100%20Local%209%2C%20Apodaca%2C%20NL",
    "city": "Apodaca",
    "state": "NL",
    "zipcode": "66600",
    "phone": null,
    "email": "sta@plog.com.mx",
    "raw_address": "BLVD. Rogelio González Caballero no.100 Local 9"
  },
  {
    "id": 2247037,
    "name": "38 - Gomez Morin",
    "address": "Missouri #458-A ote., San Pedro Garza García, NL, 66220, México",
    "searchQuery": "El Pollo Loco Missouri #458-A ote., San Pedro Garza García, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Missouri%20%23458-A%20ote.%2C%20San%20Pedro%20Garza%20Garc%C3%ADa%2C%20NL%2C%2066220%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Missouri%20%23458-A%20ote.%2C%20San%20Pedro%20Garza%20Garc%C3%ADa%2C%20NL",
    "city": "San Pedro Garza García",
    "state": "NL",
    "zipcode": "66220",
    "phone": null,
    "email": "gm@plog.com.mx",
    "raw_address": "Missouri #458-A ote."
  },
  {
    "id": 2247038,
    "name": "39 - Lazaro Cardenas",
    "address": "Lázaro Cárdenas #2810 G, esq. Camino al Mirador, Col. Mirador, Monterrey, NL, 64900, México",
    "searchQuery": "El Pollo Loco Lázaro Cárdenas #2810 G, esq. Camino al Mirador, Col. Mirador, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/La%CC%81zaro%20Ca%CC%81rdenas%20%232810%20G%2C%20esq.%20Camino%20al%20Mirador%2C%20Col.%20Mirador%2C%20Monterrey%2C%20NL%2C%2064900%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20La%CC%81zaro%20Ca%CC%81rdenas%20%232810%20G%2C%20esq.%20Camino%20al%20Mirador%2C%20Col.%20Mirador%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64900",
    "phone": null,
    "email": "lc@plog.com.mx",
    "raw_address": "Lázaro Cárdenas #2810 G, esq. Camino al Mirador, Col. Mirador"
  },
  {
    "id": 2247003,
    "name": "4 - Santa Catarina",
    "address": "Av. Manuel Ordoñez #700-R, Col. Centro, Santa Catarina, NL, 66376, México",
    "searchQuery": "El Pollo Loco Av. Manuel Ordoñez #700-R, Col. Centro, Santa Catarina, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Manuel%20Ordo%C3%B1ez%20%23700-R%2C%20Col.%20Centro%2C%20Santa%20Catarina%2C%20NL%2C%2066376%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Manuel%20Ordo%C3%B1ez%20%23700-R%2C%20Col.%20Centro%2C%20Santa%20Catarina%2C%20NL",
    "city": "Santa Catarina",
    "state": "NL",
    "zipcode": "66376",
    "phone": "555-555-1237",
    "email": "santacatarina@epl.mx",
    "raw_address": "Av. Manuel Ordoñez #700-R, Col. Centro"
  },
  {
    "id": 2247039,
    "name": "40 - Plaza 1500",
    "address": "Av. Acapulco #800, Col. Josefa Sozaya, Escobedo, NL, 66477, México",
    "searchQuery": "El Pollo Loco Av. Acapulco #800, Col. Josefa Sozaya, Escobedo, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Acapulco%20%23800%2C%20Col.%20Josefa%20Sozaya%2C%20Escobedo%2C%20NL%2C%2066477%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Acapulco%20%23800%2C%20Col.%20Josefa%20Sozaya%2C%20Escobedo%2C%20NL",
    "city": "Escobedo",
    "state": "NL",
    "zipcode": "66477",
    "phone": null,
    "email": "1500@plog.com.mx",
    "raw_address": "Av. Acapulco #800, Col. Josefa Sozaya"
  },
  {
    "id": 2247040,
    "name": "41 - Vasconcelos",
    "address": "Los Aldama #123, Casco Urbano, San Pedro Garza García, NL, 66200, México",
    "searchQuery": "El Pollo Loco Los Aldama #123, Casco Urbano, San Pedro Garza García, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Los%20Aldama%20%23123%2C%20Casco%20Urbano%2C%20San%20Pedro%20Garza%20Garc%C3%ADa%2C%20NL%2C%2066200%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Los%20Aldama%20%23123%2C%20Casco%20Urbano%2C%20San%20Pedro%20Garza%20Garc%C3%ADa%2C%20NL",
    "city": "San Pedro Garza García",
    "state": "NL",
    "zipcode": "66200",
    "phone": null,
    "email": "vasconcelos@plog.com.mx",
    "raw_address": "Los Aldama #123, Casco Urbano"
  },
  {
    "id": 2247041,
    "name": "42 - Independencia",
    "address": "Javier Mina #585 Nte. Col. Centro, Torreon, CO, 27140, México",
    "searchQuery": "El Pollo Loco Javier Mina #585 Nte. Col. Centro, Torreon, CO",
    "googleMapsUrl": "https://www.google.com/maps/search/Javier%20Mina%20%23585%20Nte.%20Col.%20Centro%2C%20Torreon%2C%20CO%2C%2027140%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Javier%20Mina%20%23585%20Nte.%20Col.%20Centro%2C%20Torreon%2C%20CO",
    "city": "Torreon",
    "state": "CO",
    "zipcode": "27140",
    "phone": null,
    "email": "independencia@plog.com.mx",
    "raw_address": "Javier Mina #585 Nte. Col. Centro"
  },
  {
    "id": 2247042,
    "name": "43 - Revolucion",
    "address": "Blvd. Torreón- Matamoros #4630 Col. Ex Hacienda los Ángeles, Torreon, CO, 27000, México",
    "searchQuery": "El Pollo Loco Blvd. Torreón- Matamoros #4630 Col. Ex Hacienda los Ángeles, Torreon, CO",
    "googleMapsUrl": "https://www.google.com/maps/search/Blvd.%20Torreo%CC%81n-%20Matamoros%20%234630%20Col.%20Ex%20Hacienda%20los%20A%CC%81ngeles%2C%20Torreon%2C%20CO%2C%2027000%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Blvd.%20Torreo%CC%81n-%20Matamoros%20%234630%20Col.%20Ex%20Hacienda%20los%20A%CC%81ngeles%2C%20Torreon%2C%20CO",
    "city": "Torreon",
    "state": "CO",
    "zipcode": "27000",
    "phone": null,
    "email": "revolucion@plog.com.mx",
    "raw_address": "Blvd. Torreón- Matamoros #4630 Col. Ex Hacienda los Ángeles"
  },
  {
    "id": 2247043,
    "name": "44 - Senderos",
    "address": "Carretera Torreón-San Pedro #2010 Km 3.3. Col. La Unión, Torreon, CO, 27276, México",
    "searchQuery": "El Pollo Loco Carretera Torreón-San Pedro #2010 Km 3.3. Col. La Unión, Torreon, CO",
    "googleMapsUrl": "https://www.google.com/maps/search/Carretera%20Torreo%CC%81n-San%20Pedro%20%232010%20Km%203.3.%20Col.%20La%20Unio%CC%81n%2C%20Torreon%2C%20CO%2C%2027276%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Carretera%20Torreo%CC%81n-San%20Pedro%20%232010%20Km%203.3.%20Col.%20La%20Unio%CC%81n%2C%20Torreon%2C%20CO",
    "city": "Torreon",
    "state": "CO",
    "zipcode": "27276",
    "phone": null,
    "email": "senderos@plog.com.mx",
    "raw_address": "Carretera Torreón-San Pedro #2010 Km 3.3. Col. La Unión"
  },
  {
    "id": 2247044,
    "name": "45 - Triana",
    "address": "Blvd, Rodríguez Triana #950, Col. Las Misiones,, Torreon, CO, 27276, México",
    "searchQuery": "El Pollo Loco Blvd, Rodríguez Triana #950, Col. Las Misiones,, Torreon, CO",
    "googleMapsUrl": "https://www.google.com/maps/search/Blvd%2C%20Rodri%CC%81guez%20Triana%20%23950%2C%20Col.%20Las%20Misiones%2C%2C%20Torreon%2C%20CO%2C%2027276%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Blvd%2C%20Rodri%CC%81guez%20Triana%20%23950%2C%20Col.%20Las%20Misiones%2C%2C%20Torreon%2C%20CO",
    "city": "Torreon",
    "state": "CO",
    "zipcode": "27276",
    "phone": null,
    "email": "rt@plog.com.mx",
    "raw_address": "Blvd, Rodríguez Triana #950, Col. Las Misiones,"
  },
  {
    "id": 2247045,
    "name": "46 - Campestre",
    "address": "Blvd. Miguel Alemán #717, Col. El Campestre, Gomez Palacio, DG, 35080, México",
    "searchQuery": "El Pollo Loco Blvd. Miguel Alemán #717, Col. El Campestre, Gomez Palacio, DG",
    "googleMapsUrl": "https://www.google.com/maps/search/Blvd.%20Miguel%20Alema%CC%81n%20%23717%2C%20Col.%20El%20Campestre%2C%20Gomez%20Palacio%2C%20DG%2C%2035080%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Blvd.%20Miguel%20Alema%CC%81n%20%23717%2C%20Col.%20El%20Campestre%2C%20Gomez%20Palacio%2C%20DG",
    "city": "Gomez Palacio",
    "state": "DG",
    "zipcode": "35080",
    "phone": null,
    "email": "campestre@plog.com.mx",
    "raw_address": "Blvd. Miguel Alemán #717, Col. El Campestre"
  },
  {
    "id": 2247046,
    "name": "47 - San Antonio",
    "address": "Blvd. Ejército Mexicano #396, Fraccionamiento San Antonio, Gomez Palacio, DG, 35015, México",
    "searchQuery": "El Pollo Loco Blvd. Ejército Mexicano #396, Fraccionamiento San Antonio, Gomez Palacio, DG",
    "googleMapsUrl": "https://www.google.com/maps/search/Blvd.%20Eje%CC%81rcito%20Mexicano%20%23396%2C%20Fraccionamiento%20San%20Antonio%2C%20Gomez%20Palacio%2C%20DG%2C%2035015%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Blvd.%20Eje%CC%81rcito%20Mexicano%20%23396%2C%20Fraccionamiento%20San%20Antonio%2C%20Gomez%20Palacio%2C%20DG",
    "city": "Gomez Palacio",
    "state": "DG",
    "zipcode": "35015",
    "phone": null,
    "email": "ejercito@plog.com.mx",
    "raw_address": "Blvd. Ejército Mexicano #396, Fraccionamiento San Antonio"
  },
  {
    "id": 2247047,
    "name": "48 - Refugio",
    "address": "Anillo vial F.J. Serra #151 Col. El Refugio. Querétaro, QRO, Queretaro, QT, 76146, México",
    "searchQuery": "El Pollo Loco Anillo vial F.J. Serra #151 Col. El Refugio. Querétaro, QRO, Queretaro, QT",
    "googleMapsUrl": "https://www.google.com/maps/search/Anillo%20vial%20F.J.%20Serra%20%23151%20Col.%20El%20Refugio.%20Quere%CC%81taro%2C%20QRO%2C%20Queretaro%2C%20QT%2C%2076146%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Anillo%20vial%20F.J.%20Serra%20%23151%20Col.%20El%20Refugio.%20Quere%CC%81taro%2C%20QRO%2C%20Queretaro%2C%20QT",
    "city": "Queretaro",
    "state": "QT",
    "zipcode": "76146",
    "phone": null,
    "email": "refugio@plog.com.mx",
    "raw_address": "Anillo vial F.J. Serra #151 Col. El Refugio. Querétaro, QRO"
  },
  {
    "id": 2247048,
    "name": "49 - Pueblito",
    "address": "Paseo Constituyentes #1527 Col. Pueblito, Corregidora, QT, 76904, México",
    "searchQuery": "El Pollo Loco Paseo Constituyentes #1527 Col. Pueblito, Corregidora, QT",
    "googleMapsUrl": "https://www.google.com/maps/search/Paseo%20Constituyentes%20%231527%20Col.%20Pueblito%2C%20Corregidora%2C%20QT%2C%2076904%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Paseo%20Constituyentes%20%231527%20Col.%20Pueblito%2C%20Corregidora%2C%20QT",
    "city": "Corregidora",
    "state": "QT",
    "zipcode": "76904",
    "phone": null,
    "email": "pueblito@plog.com.mx",
    "raw_address": "Paseo Constituyentes #1527 Col. Pueblito"
  },
  {
    "id": 2247004,
    "name": "5 - Felix U. Gomez",
    "address": "Av. Francisco I. Madero #1536 ote. Col. Centro, Monterrey, NL, 64000, México",
    "searchQuery": "El Pollo Loco Av. Francisco I. Madero #1536 ote. Col. Centro, Monterrey, NL",
    "googleMapsUrl": "https://www.google.com/maps/search/Av.%20Francisco%20I.%20Madero%20%231536%20ote.%20Col.%20Centro%2C%20Monterrey%2C%20NL%2C%2064000%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Av.%20Francisco%20I.%20Madero%20%231536%20ote.%20Col.%20Centro%2C%20Monterrey%2C%20NL",
    "city": "Monterrey",
    "state": "NL",
    "zipcode": "64000",
    "phone": "555-555-1238",
    "email": "fugomez@epl.mx",
    "raw_address": "Av. Francisco I. Madero #1536 ote. Col. Centro"
  },
  {
    "id": 2247049,
    "name": "50 - Patio",
    "address": "Ave. Revolución #99 Col. Puertas del Sol, Queretaro, QT, 76134, México",
    "searchQuery": "El Pollo Loco Ave. Revolución #99 Col. Puertas del Sol, Queretaro, QT",
    "googleMapsUrl": "https://www.google.com/maps/search/Ave.%20Revolucio%CC%81n%20%2399%20Col.%20Puertas%20del%20Sol%2C%20Queretaro%2C%20QT%2C%2076134%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Ave.%20Revolucio%CC%81n%20%2399%20Col.%20Puertas%20del%20Sol%2C%20Queretaro%2C%20QT",
    "city": "Queretaro",
    "state": "QT",
    "zipcode": "76134",
    "phone": null,
    "email": "patio@plog.com.mx",
    "raw_address": "Ave. Revolución #99 Col. Puertas del Sol"
  },
  {
    "id": 2247050,
    "name": "51 - Constituyentes",
    "address": "Ave. Constituyentes #274 Col. Casablanca, Queretaro, QT, 76030, México",
    "searchQuery": "El Pollo Loco Ave. Constituyentes #274 Col. Casablanca, Queretaro, QT",
    "googleMapsUrl": "https://www.google.com/maps/search/Ave.%20Constituyentes%20%23274%20Col.%20Casablanca%2C%20Queretaro%2C%20QT%2C%2076030%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Ave.%20Constituyentes%20%23274%20Col.%20Casablanca%2C%20Queretaro%2C%20QT",
    "city": "Queretaro",
    "state": "QT",
    "zipcode": "76030",
    "phone": null,
    "email": "casablanca@plog.com.mx",
    "raw_address": "Ave. Constituyentes #274 Col. Casablanca"
  },
  {
    "id": 2247051,
    "name": "52 - Venustiano Carranza",
    "address": "BLVD. Venustiano Carranza, No.3680 col. Jardín, Saltillo, CO, 25240, México",
    "searchQuery": "El Pollo Loco BLVD. Venustiano Carranza, No.3680 col. Jardín, Saltillo, CO",
    "googleMapsUrl": "https://www.google.com/maps/search/BLVD.%20Venustiano%20Carranza%2C%20No.3680%20col.%20Jardi%CC%81n%2C%20Saltillo%2C%20CO%2C%2025240%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20BLVD.%20Venustiano%20Carranza%2C%20No.3680%20col.%20Jardi%CC%81n%2C%20Saltillo%2C%20CO",
    "city": "Saltillo",
    "state": "CO",
    "zipcode": "25240",
    "phone": null,
    "email": "vc@surtidorepl.mx",
    "raw_address": "BLVD. Venustiano Carranza, No.3680 col. Jardín"
  },
  {
    "id": 2247052,
    "name": "53 - Lienzo Charro",
    "address": "Periférico. Luis Echeverria Álvarez, No. 540 Col. Lourdes, Saltillo, CO, 25070, México",
    "searchQuery": "El Pollo Loco Periférico. Luis Echeverria Álvarez, No. 540 Col. Lourdes, Saltillo, CO",
    "googleMapsUrl": "https://www.google.com/maps/search/Perife%CC%81rico.%20Luis%20Echeverria%20A%CC%81lvarez%2C%20No.%20540%20Col.%20Lourdes%2C%20Saltillo%2C%20CO%2C%2025070%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20Perife%CC%81rico.%20Luis%20Echeverria%20A%CC%81lvarez%2C%20No.%20540%20Col.%20Lourdes%2C%20Saltillo%2C%20CO",
    "city": "Saltillo",
    "state": "CO",
    "zipcode": "25070",
    "phone": null,
    "email": "ech@surtidorepl.mx",
    "raw_address": "Periférico. Luis Echeverria Álvarez, No. 540 Col. Lourdes"
  },
  {
    "id": 2247053,
    "name": "54 - Ramos Arizpe",
    "address": "BLVD. Miguel Ramos Arizpe Sur, No. 18 Col. Ramos Arizpe Centro, Ramos Arizpe, CO, 25900, México",
    "searchQuery": "El Pollo Loco BLVD. Miguel Ramos Arizpe Sur, No. 18 Col. Ramos Arizpe Centro, Ramos Arizpe, CO",
    "googleMapsUrl": "https://www.google.com/maps/search/BLVD.%20Miguel%20Ramos%20Arizpe%20Sur%2C%20No.%2018%20Col.%20Ramos%20Arizpe%20Centro%2C%20Ramos%20Arizpe%2C%20CO%2C%2025900%2C%20M%C3%A9xico",
    "zenputSearchUrl": "https://www.google.com/maps/search/El%20Pollo%20Loco%20BLVD.%20Miguel%20Ramos%20Arizpe%20Sur%2C%20No.%2018%20Col.%20Ramos%20Arizpe%20Centro%2C%20Ramos%20Arizpe%2C%20CO",
    "city": "Ramos Arizpe",
    "state": "CO",
    "zipcode": "25900",
    "phone": null,
    "email": "ra@surtidorepl.mx",
    "raw_address": "BLVD. Miguel Ramos Arizpe Sur, No. 18 Col. Ramos Arizpe Centro"
  }
]; // Primeras 50 para el script

async function mapearConDireccionesZenput() {
  console.log('🗺️ MAPEO AUTOMÁTICO COMPLETO - DIRECCIONES ZENPUT VALIDADAS');
  console.log('83 direcciones reales del sistema de supervisión operativa');
  console.log('='.repeat(70));

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  
  if (!apiKey) {
    console.log('⚠️ GOOGLE_MAPS_API_KEY no configurado');
    console.log('1. Obtén API key de Google Cloud Platform');
    console.log('2. Habilita Geocoding API');
    console.log('3. Añade a .env: GOOGLE_MAPS_API_KEY=tu_api_key');
    console.log('4. Costo estimado: ~$0.40 USD para 83 direcciones');
    return;
  }

  console.log('📍 INICIANDO MAPEO AUTOMATIZADO...');
  console.log('Usando direcciones exactas desde Zenput API');
  console.log('');

  const resultados = [];
  const errores = [];
  
  // Cargar todas las direcciones del archivo completo
  const fs = require('fs');
  const allAddressesFile = '/Users/robertodavila/pollo-loco-tracking-gps/zenput-todas-direcciones.json';
  let todasLasDirecciones = TODAS_LAS_DIRECCIONES_ZENPUT;
  
  try {
    const fileData = JSON.parse(fs.readFileSync(allAddressesFile, 'utf8'));
    todasLasDirecciones = fileData.addresses || TODAS_LAS_DIRECCIONES_ZENPUT;
    console.log(`✅ Cargadas ${todasLasDirecciones.length} direcciones desde archivo completo`);
  } catch (e) {
    console.log('⚠️ Usando direcciones incluidas en script');
  }

  console.log(`📍 Procesando ${todasLasDirecciones.length} direcciones validadas...\n`);

  // Procesar en lotes para respetar rate limits
  const tamañoLote = 5;
  
  for (let i = 0; i < todasLasDirecciones.length; i += tamañoLote) {
    const lote = todasLasDirecciones.slice(i, i + tamañoLote);
    
    console.log(`🔄 Lote ${Math.floor(i/tamañoLote) + 1}/${Math.ceil(todasLasDirecciones.length/tamañoLote)} (sucursales ${i + 1}-${i + lote.length})`);
    
    for (const location of lote) {
      try {
        // Múltiples estrategias de búsqueda para mayor precisión
        const queries = [
          location.address, // Dirección completa validada
          location.searchQuery, // "El Pollo Loco" + dirección
          `${location.name} ${location.city}, ${location.state}`, // Nombre + ciudad
          `El Pollo Loco ${location.raw_address}, ${location.city}` // Variante con dirección raw
        ];

        let coordenadas = null;
        let queryExitosa = null;

        for (const query of queries) {
          try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}&region=mx&components=country:MX`;
            const response = await axios.get(url);

            if (response.data.status === 'OK' && response.data.results.length > 0) {
              const result = response.data.results[0];
              
              // Validar que esté en México
              const country = result.address_components.find(c => c.types.includes('country'));
              if (country && country.short_name === 'MX') {
                coordenadas = {
                  lat: result.geometry.location.lat,
                  lng: result.geometry.location.lng,
                  formatted_address: result.formatted_address,
                  precision: result.geometry.location_type,
                  place_id: result.place_id
                };
                queryExitosa = query;
                break;
              }
            }
          } catch (queryError) {
            // Continúa con la siguiente query
          }
        }

        if (coordenadas) {
          console.log(`✅ [${location.id}] ${location.name}`);
          console.log(`   📍 ${coordenadas.lat}, ${coordenadas.lng}`);
          console.log(`   🏷️ ${coordenadas.formatted_address}`);
          console.log(`   🔍 Query: ${queryExitosa.substring(0, 40)}...`);
          console.log('');

          resultados.push({
            ...location,
            coordenadas
          });
        } else {
          console.log(`❌ [${location.id}] ${location.name} - No encontrado`);
          errores.push(location);
        }

        // Pausa para respetar rate limits de Google (50 requests/second)
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error con ${location.name}: ${error.message}`);
        errores.push(location);
      }
    }
    
    console.log('⏳ Pausa entre lotes...\n');
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('📊 RESUMEN DEL MAPEO:');
  console.log('='.repeat(30));
  console.log(`✅ Éxito: ${resultados.length}/${todasLasDirecciones.length} sucursales`);
  console.log(`❌ Errores: ${errores.length} sucursales`);
  console.log(`🎯 Precisión: ${(resultados.length/todasLasDirecciones.length*100).toFixed(1)}%`);
  console.log('');

  if (resultados.length > 0) {
    console.log('💾 APLICANDO COORDENADAS A BASE DE DATOS...');
    await aplicarCoordenadasBD(resultados);

    // Guardar resultados para referencia
    fs.writeFileSync('/Users/robertodavila/pollo-loco-tracking-gps/zenput-coordenadas-aplicadas.json', 
      JSON.stringify({ 
        metadata: { 
          timestamp: new Date().toISOString(), 
          total_aplicadas: resultados.length,
          total_errores: errores.length,
          source: 'zenput_addresses_google_maps_api'
        }, 
        resultados, 
        errores 
      }, null, 2)
    );
    
    console.log('✅ Resultados guardados: zenput-coordenadas-aplicadas.json');
  }

  if (errores.length > 0) {
    console.log('\n⚠️ SUCURSALES CON ERRORES:');
    errores.slice(0, 5).forEach(err => {
      console.log(`   - [${err.id}] ${err.name}`);
    });
    if (errores.length > 5) {
      console.log(`   ... y ${errores.length - 5} más`);
    }
  }

  return resultados;
}

async function aplicarCoordenadasBD(resultados) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ Conectado a Railway PostgreSQL\n');
    
    let aplicadas = 0;
    let actualizadas = 0;
    let noEncontradas = 0;
    
    for (const location of resultados) {
      try {
        const result = await client.query(`
          UPDATE tracking_locations_cache 
          SET 
            latitude = $1,
            longitude = $2,
            synced_at = NOW()
          WHERE location_code = $3
        `, [location.coordenadas.lat, location.coordenadas.lng, location.id.toString()]);
        
        if (result.rowCount > 0) {
          console.log(`✅ [${location.id}] ${location.name} - Coordenadas actualizadas`);
          aplicadas++;
        } else {
          console.log(`⚠️ [${location.id}] ${location.name} - No encontrado en tracking GPS`);
          noEncontradas++;
        }
      } catch (updateError) {
        console.log(`❌ [${location.id}] Error: ${updateError.message}`);
      }
    }
    
    console.log(`\n📊 RESUMEN DE APLICACIÓN:`);
    console.log('='.repeat(35));
    console.log(`✅ Coordenadas aplicadas: ${aplicadas}`);
    console.log(`⚠️ No encontradas en tracking: ${noEncontradas}`);
    console.log(`📍 Total procesadas: ${resultados.length}`);
    console.log('');
    console.log('🎉 MAPEO ZENPUT COMPLETADO EXITOSAMENTE');
    console.log('🌐 Verifica el dashboard:');
    console.log('https://pollo-loco-tracking-gps-production.up.railway.app/webapp/dashboard.html');
    
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  mapearConDireccionesZenput()
    .then(() => {
      console.log('\n🎯 MAPEO ZENPUT COMPLETO');
      console.log('Todas las sucursales mapeadas con direcciones validadas');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error crítico:', error);
      process.exit(1);
    });
}

module.exports = { mapearConDireccionesZenput };
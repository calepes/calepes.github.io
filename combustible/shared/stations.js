/**
 * Estaciones de combustible — configuracion compartida
 * Fuente: widget/cards-widget.js
 */

export const GASGROUP_MIN_LITROS = 1500;

export const STATIONS = [
  {
    name: "Genex Banzer",
    type: "genex",
    company: "Genex",
    lat: -17.7580, lon: -63.1783,
    url:
      "https://genex.com.bo/estaciones/" +
      "?3142_product_cat%5B0%5D=294" +
      "&3142_tax_product_tag%5B0%5D=314" +
      "&3142_orderby=option_1" +
      "&3142_filtered=true",
    key: "GENEX I",
    fuel: "G. ESPECIAL+",
    waze: "https://waze.com/ul?q=Genex%20Banzer%203er%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Vangas",
    type: "genex",
    company: "Genex",
    lat: -17.8100, lon: -63.1650,
    url: "https://genex.com.bo/estaciones/",
    key: "VANGAS",
    fuel: "G. ESPECIAL+",
    waze: "https://waze.com/ul?q=Vangas%20Hernando%20Sanabria%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Urubó",
    type: "gasgroup",
    company: "Orsa",
    lat: -17.7533, lon: -63.2213,
    url: "https://gasgroup.com.bo/api/obtener-datos-temporales/CTqmwWgj",
    product: "GASOLINA ESPECIAL",
    waze: "https://waze.com/ul?q=Orsa%20Urubo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Equipetrol",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7542, lon: -63.1967,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "EQUIPETROL",
    waze: "https://waze.com/ul?q=Biopetrol%20Equipetrol%204to%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Pirai",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7800, lon: -63.2000,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "PIRAI",
    waze: "https://waze.com/ul?q=Biopetrol%20Pirai%20Roca%20y%20Coronado%203er%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Alemana",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7718, lon: -63.1682,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Alemana",
    waze: "https://waze.com/ul?q=Biopetrol%20Alemana%202do%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "López",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7400, lon: -63.2200,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Lopez",
    waze: "https://waze.com/ul?q=Biopetrol%20Lopez%20Banzer%207mo%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Viru Viru",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7200, lon: -63.1700,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Viru Viru",
    waze: "https://waze.com/ul?q=Biopetrol%20Viru%20Viru%20Banzer%20Km%2010%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Gasco",
    type: "ec2",
    company: "Biopetrol",
    lat: -17.7580, lon: -63.1783,
    url: "http://ec2-3-22-240-207.us-east-2.compute.amazonaws.com/guiasaldos/main/donde/134",
    key: "Gasco",
    waze: "https://waze.com/ul?q=Biopetrol%20Gasco%20Banzer%203er%20Anillo%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
  {
    name: "Rivero",
    type: "gsheets",
    company: "Rivero",
    lat: -17.7700, lon: -63.1900,
    url:
      "https://docs.google.com/spreadsheets/u/0/d/e/" +
      "2CAIWO3els60V5S1vVAh0cccQxdcZ1MYZhD9A1pQ-ojCNPoNh-" +
      "vJjHhJaUalVsDLQivYf_Z23Un8mEaePxSg" +
      "/gviz/chartiframe?oid=1546358769&resourcekey",
    product: "ESPECIAL",
    waze: "https://waze.com/ul?q=Surtidor%20Rivero%20Banzer%20Km%201.5%20Santa%20Cruz%20Bolivia&navigate=yes",
  },
];

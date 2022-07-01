console.log("Running program");

const PORT = 8810;
const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const app = express();

// function searchClassData

//No params case: API usage
app.get("/", (req, res) => {
  res.json(
    "Usage: /<year>/<term>/<campus>/<subject, CRN, course number>\n" +
      "Example: /2022/fall/rocklin/csci"
  );
});

app.get("/:year/:term/:campus/:id", (req, res) => {
  var term = -1;
  var nextIsNowTerm = false;
  var nowTerm;

  axios
    .get("https://ssb.sierracollege.edu:8810/PROD/pw_sigsched.p_Search")
    .then((response) => {
      const data = response.data;
      const html = cheerio.load(data);

      html("option", data).each(function () {
        var termAndYear = html(this).text();
        var id = html(this).attr("value");

        var array = termAndYear.split(" ");
        if (
          array[1] == req.params.year &&
          array[0].toLowerCase() == req.params.term.toLowerCase()
        ) {
          term = id;
        }
        if (id == "X") {
          nextIsNowTerm = true;
        }
        if (nextIsNowTerm) {
          nextIsNowTerm = false;
          nowTerm = id;
        }
      });
      if (term === -1) term = nowTerm;
    });
  var array = [term, req.params.campus, req.params.id];
  res.json(array);
});

app.listen(PORT, () => console.log("Running on PORT " + PORT));

